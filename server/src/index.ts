/**
 * Express server entry point for the Ovatu Webhook Relay.
 *
 * - Mounts API routes
 * - Serves built frontend assets in production
 * - Runs DB migrations on boot
 * - Starts the polling engine
 */

import express from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { migrate } from "./db/index.js";
import { startPolling } from "./services/poller.js";
import authRouter from "./routes/auth.js";
import webhooksRouter from "./routes/webhooks.js";
import eventsRouter from "./routes/events.js";
import healthRouter from "./routes/health.js";

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use("/api/auth", authRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/events", eventsRouter);
app.use("/api/health", healthRouter);

// ---------------------------------------------------------------------------
// Static frontend (production only)
// ---------------------------------------------------------------------------

if (config.nodeEnv === "production") {
  // Resolve the frontend dist directory relative to the server's location
  // In Docker: CWD is /app, frontend is at /app/frontend/dist
  const frontendDist = path.resolve(process.cwd(), "frontend/dist");

  if (existsSync(frontendDist)) {
    console.log(`[server] serving static frontend from ${frontendDist}`);
    app.use(express.static(frontendDist));

    // SPA fallback: any non-API GET request serves index.html
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  } else {
    console.warn(`[server] frontend dist not found at ${frontendDist}, skipping static serve`);
  }
}

// ---------------------------------------------------------------------------
// Fallback 404 (only reached when not in production or when frontend dist
// doesn't exist — in production with SPA fallback, unmatched routes are
// handled by index.html)
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// Run database migrations
migrate();

// Start HTTP server
app.listen(config.port, config.host, () => {
  console.log(`[server] Ovatu Webhook Relay listening on http://${config.host}:${config.port}`);
  console.log(`[server] environment: ${config.nodeEnv}`);
  console.log(`[server] Ovatu API base: ${config.ovatuApiBaseUrl}`);

  // Start polling engine (disabled in test mode)
  if (config.nodeEnv !== "test") {
    startPolling(config.pollingIntervalSec * 1000);
  }
});

export default app;