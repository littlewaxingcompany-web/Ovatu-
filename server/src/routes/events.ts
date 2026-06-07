/**
 * Event log routes — view event history for the authenticated user.
 */

import { Router, type Request, type Response } from "express";
import { findUserByEmail } from "../db/index.js";
import { listEvents } from "../db/index.js";

const router = Router();

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

/** GET /api/events?limit=50&offset=0 */
router.get("/", (req: Request, res: Response): void => {
  const user = resolveUser(req, res);
  if (!user) return;

  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  const events = listEvents(user.id, limit, offset);
  res.json({ events });
});

export default router;