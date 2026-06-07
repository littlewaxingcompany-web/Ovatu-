/**
 * Polling engine — periodically fetches recent bookings from Ovatu,
 * detects changes (new, cancelled, rescheduled, check-in), logs events
 * to the database, and dispatches webhooks to configured Zapier URLs.
 *
 * Change detection works by comparing the current Ovatu booking state
 * against previously stored event_log entries. Each detected change
 * is logged to event_log (with webhook_id=NULL) for state tracking,
 * then separately dispatched to matching webhooks.
 */

import { config } from "../config.js";
import {
  createEventLog,
  findEventsByOvatuId,
  listAllUsers,
  listWebhooks,
  updateLastCheckedAt,
} from "../db/index.js";
import { OvatuClient, type OvatuAppointment } from "./ovatu.js";
import { dispatchEvent } from "./webhook.js";
import type { EventType, WebhookPayload } from "../types.js";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isPolling = false; // guard against overlapping poll cycles

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Start the polling loop. Idempotent — safe to call multiple times. */
export function startPolling(intervalMs: number): void {
  if (pollTimer) {
    console.log("[poller] already running");
    return;
  }

  console.log(`[poller] starting — polling every ${intervalMs}ms`);

  const poll = async () => {
    if (isPolling) {
      console.log("[poller] previous cycle still in progress, skipping");
      return;
    }
    isPolling = true;
    try {
      await pollOnce();
    } catch (err) {
      console.error("[poller] error during poll cycle:", err);
    } finally {
      isPolling = false;
    }
  };

  // Run immediately on start, then on interval
  poll();
  pollTimer = setInterval(poll, intervalMs);
}

/** Stop the polling loop. */
export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    isPolling = false;
    console.log("[poller] stopped");
  }
}

// ---------------------------------------------------------------------------
// Poll cycle
// ---------------------------------------------------------------------------

async function pollOnce(): Promise<void> {
  const users = listAllUsers();
  if (users.length === 0) {
    console.log("[poller] no users registered, nothing to poll");
    return;
  }

  for (const user of users) {
    // Quick skip: user has no active webhooks at all
    const userWebhooks = listWebhooks(user.id).filter((w) => w.active === 1);
    if (userWebhooks.length === 0) {
      // Still check and log events for state tracking even without webhooks,
      // but skip if there are truly no webhooks configured.
      // We do poll even without webhooks so we have state history.
    }

    try {
      await pollUser(user.id, user.ovatu_api_key, user.last_checked_at);
    } catch (err) {
      console.error(`[poller] error polling user ${user.id}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Poll a single user
// ---------------------------------------------------------------------------

/** How far back to look on the very first poll (no last_checked_at). */
const INITIAL_LOOKBACK_HOURS = 24;

async function pollUser(
  userId: string,
  ovatuApiKey: string,
  lastCheckedAt: string | null
): Promise<void> {
  const client = new OvatuClient(ovatuApiKey, config.ovatuApiBaseUrl);

  // Determine the "after" timestamp for the Ovatu API query
  let after: string | undefined;
  if (lastCheckedAt) {
    after = lastCheckedAt;
    console.log(`[poller] user ${userId.slice(0, 8)} — polling since ${after}`);
  } else {
    // First poll — look back N hours
    const d = new Date(Date.now() - INITIAL_LOOKBACK_HOURS * 60 * 60 * 1000);
    after = d.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
    console.log(
      `[poller] user ${userId.slice(0, 8)} — initial poll since ${after}`
    );
  }

  let appointments: OvatuAppointment[];
  try {
    appointments = await client.getAppointments({ after });
  } catch (err) {
    // If the Ovatu API is unreachable, log and move on
    console.warn(`[poller] user ${userId.slice(0, 8)} — Ovatu API error:`, err);
    return;
  }

  if (appointments.length === 0) {
    console.log(`[poller] user ${userId.slice(0, 8)} — no changes`);
    updateLastCheckedAt(userId);
    return;
  }

  console.log(
    `[poller] user ${userId.slice(0, 8)} — ${appointments.length} appointment(s) to process`
  );

  for (const apt of appointments) {
    await processAppointment(userId, apt);
  }

  updateLastCheckedAt(userId);
  console.log(`[poller] user ${userId.slice(0, 8)} — done, last_checked_at updated`);
}

// ---------------------------------------------------------------------------
// Change detection for a single appointment
// ---------------------------------------------------------------------------

async function processAppointment(
  userId: string,
  apt: OvatuAppointment
): Promise<void> {
  // Look up what we've already seen for this booking
  const existingEvents = findEventsByOvatuId(apt.id);

  if (existingEvents.length === 0) {
    // --- Brand new booking (never seen before) ---
    const eventType: EventType =
      apt.status === "cancelled" ? "cancelled_booking" : "new_booking";

    const payload = buildPayload(eventType, apt);
    const payloadJson = JSON.stringify(payload);

    // Log the raw event for state tracking
    createEventLog(userId, null, apt.id, eventType, payloadJson);

    // Dispatch to matching webhooks
    await dispatchEvent(userId, eventType, apt.id, payload);
    return;
  }

  // --- Previously seen booking — check for changes ---
  // The most recent event_log entry holds the last known state
  const latestEvent = existingEvents[0];
  const prevPayload: WebhookPayload = JSON.parse(latestEvent.payload);
  const prevBooking = prevPayload.booking;
  const prevStatus = prevBooking.status;

  // Detect cancellation
  if (prevStatus !== "cancelled" && apt.status === "cancelled") {
    const eventType: EventType = "cancelled_booking";
    const payload = buildPayload(eventType, apt);
    const payloadJson = JSON.stringify(payload);
    createEventLog(userId, null, apt.id, eventType, payloadJson);
    await dispatchEvent(userId, eventType, apt.id, payload);
    return;
  }

  // Detect check-in
  if (apt.status === "checked_in" || apt.status === "checked in") {
    const eventType: EventType = "check_in";
    const payload = buildPayload(eventType, apt);
    const payloadJson = JSON.stringify(payload);
    createEventLog(userId, null, apt.id, eventType, payloadJson);
    await dispatchEvent(userId, eventType, apt.id, payload);
    return;
  }

  // Detect reschedule (time changed)
  if (
    prevStatus !== "cancelled" &&
    prevBooking.start_time !== apt.start_time
  ) {
    const eventType: EventType = "rescheduled_booking";
    const payload = buildPayload(eventType, apt);
    const payloadJson = JSON.stringify(payload);
    createEventLog(userId, null, apt.id, eventType, payloadJson);
    await dispatchEvent(userId, eventType, apt.id, payload);
    return;
  }

  // No change detected — this appointment was updated for reasons we
  // don't care about (e.g. internal Ovatu metadata changes).
  console.log(
    `[poller] appointment ${apt.id.slice(0, 8)} — no relevant change, skipping`
  );
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

function buildPayload(event: EventType, apt: OvatuAppointment): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    business: {
      id: apt.location_id || "unknown",
      name: apt.location_name || "Unknown Business",
    },
    booking: {
      id: apt.id,
      start_time: apt.start_time,
      end_time: apt.end_time,
      status: apt.status,
      service: apt.service_name || "Unknown Service",
      staff_name: apt.staff_name || "Unknown Staff",
      customer_name: apt.customer_name || "Unknown Customer",
      customer_phone: apt.customer_phone || "",
    },
  };
}
