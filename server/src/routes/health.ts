/**
 * Health check endpoint.
 */

import { Router, type Request, type Response } from "express";
import { config } from "../config.js";

const router = Router();

/** Simple health probe used by load balancers / monitoring */
router.get("/", (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "0.1.0",
    pollingIntervalSec: config.pollingIntervalSec,
  });
});

export default router;