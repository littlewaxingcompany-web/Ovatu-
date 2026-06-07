/**
 * Webhook dispatcher — fires HTTP POST to configured Zapier URLs.
 * Implements retry logic with exponential backoff.
 */

import { createEventLog, findUserById, listWebhooks, updateEventStatus } from "../db/index.js";
import type { EventType, WebhookPayload } from "../types.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000; // 1 second

interface DispatchResult {
  webhookId: string;
  status: "sent" | "failed";
  responseStatus: number | null;
}

/**
 * Fire a webhook event to all active webhooks configured by the given user.
 * Returns an array of dispatch results, one per webhook.
 */
export async function dispatchEvent(
  userId: string,
  eventType: EventType,
  ovatuBookingId: string,
  payload: WebhookPayload
): Promise<DispatchResult[]> {
  const user = findUserById(userId);
  if (!user) {
    console.warn(`[webhook] user ${userId} not found, skipping dispatch`);
    return [];
  }

  const webhooks = listWebhooks(userId).filter((w) => w.active === 1);
  if (webhooks.length === 0) {
    console.log(`[webhook] no active webhooks for user ${userId}`);
    return [];
  }

  const payloadJson = JSON.stringify(payload);
  const results: DispatchResult[] = [];

  for (const wh of webhooks) {
    // Check if this webhook subscribes to this event type
    const subscribedEvents: string[] = JSON.parse(wh.events);
    if (!subscribedEvents.includes(eventType)) {
      continue;
    }

    // Create the event log entry (status = pending)
    const eventLog = createEventLog(
      userId,
      wh.id,
      ovatuBookingId,
      eventType,
      payloadJson
    );

    // Attempt delivery with retries
    let lastStatus: number | null = null;
    let success = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        if (attempt > 0) {
          console.log(
            `[webhook] retry ${attempt + 1}/${MAX_RETRIES} for webhook ${wh.id} after ${delay}ms`
          );
          await sleep(delay);
        }

        const response = await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadJson,
        });

        lastStatus = response.status;
        if (response.ok) {
          success = true;
          break;
        }
      } catch (err) {
        console.error(
          `[webhook] attempt ${attempt + 1} failed for webhook ${wh.id}:`,
          err
        );
        lastStatus = 0; // network error
      }
    }

    const finalStatus = success ? "sent" : "failed";
    updateEventStatus(eventLog.id, finalStatus, lastStatus);

    results.push({
      webhookId: wh.id,
      status: finalStatus,
      responseStatus: lastStatus,
    });

    console.log(
      `[webhook] dispatch to ${wh.url}: ${finalStatus} (HTTP ${lastStatus})`
    );
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
