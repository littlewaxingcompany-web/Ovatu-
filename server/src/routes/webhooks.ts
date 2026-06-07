/**
 * Webhook CRUD routes.
 *
 * Authentication: The caller must pass an `X-User-Email` header that matches
 * an existing user. (Full JWT-based session auth can be layered on later.)
 */

import { Router, type Request, type Response } from "express";
import { findUserByEmail } from "../db/index.js";
import {
  listWebhooks,
  findWebhookById,
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from "../db/index.js";
import type { WebhookRequest } from "../types.js";

const router = Router();

// ---------------------------------------------------------------------------
// Middleware: resolve user from header
// ---------------------------------------------------------------------------

function resolveUser(req: Request, res: Response): import("../types.js").User | null {
  const email = req.headers["x-user-email"] as string | undefined;
  if (!email) {
    res.status(401).json({ error: "Missing X-User-Email header" });
    return null;
  }
  const user = findUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return null;
  }
  return user;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** GET /api/webhooks — list all webhooks for the authenticated user */
router.get("/", (req: Request, res: Response): void => {
  const user = resolveUser(req, res);
  if (!user) return;

  const webhooks = listWebhooks(user.id).map((w) => ({
    ...w,
    events: JSON.parse(w.events),
  }));

  res.json({ webhooks });
});

/** POST /api/webhooks — create a new webhook configuration */
router.post("/", (req: Request, res: Response): void => {
  const user = resolveUser(req, res);
  if (!user) return;

  const { name, url, events } = req.body as WebhookRequest;

  if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "name, url, and events (non-empty array) are required" });
    return;
  }

  const validEvents = ["new_booking", "cancelled_booking", "rescheduled_booking", "check_in"];
  for (const e of events) {
    if (!validEvents.includes(e)) {
      res.status(400).json({
        error: `Invalid event type: "${e}". Valid: ${validEvents.join(", ")}`,
      });
      return;
    }
  }

  const webhook = createWebhook(user.id, name, url, events);
  res.status(201).json({ webhook: { ...webhook, events: JSON.parse(webhook.events) } });
});

/** PUT /api/webhooks/:id — update an existing webhook */
router.put("/:id", (req: Request, res: Response): void => {
  const user = resolveUser(req, res);
  if (!user) return;

  const existing = findWebhookById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }
  if (existing.user_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, url, events, active } = req.body as WebhookRequest & { active?: number };

  const finalName = name ?? existing.name;
  const finalUrl = url ?? existing.url;
  const finalEvents = events ?? JSON.parse(existing.events);
  const finalActive = active !== undefined ? active : existing.active;

  const updated = updateWebhook(
    req.params.id,
    finalName,
    finalUrl,
    finalEvents,
    finalActive
  );
  if (!updated) {
    res.status(500).json({ error: "Failed to update webhook" });
    return;
  }

  res.json({ webhook: { ...updated, events: JSON.parse(updated.events) } });
});

/** DELETE /api/webhooks/:id — delete a webhook */
router.delete("/:id", (req: Request, res: Response): void => {
  const user = resolveUser(req, res);
  if (!user) return;

  const existing = findWebhookById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }
  if (existing.user_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  deleteWebhook(req.params.id);
  res.json({ message: "Webhook deleted" });
});

export default router;