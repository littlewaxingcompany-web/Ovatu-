import { randomUUID } from "node:crypto";

/**
 * Application configuration loaded from environment variables.
 */
export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "0.0.0.0",

  /** Ovatu API base URL (overrideable for testing) */
  ovatuApiBaseUrl: process.env.OVATU_API_BASE_URL || "https://api.ovatu.com/v1",

  /** How often to poll Ovatu for changes (in seconds) */
  pollingIntervalSec: parseInt(process.env.POLLING_INTERVAL_SEC || "60", 10),

  /** When set, all CORS origins are allowed. Otherwise restricted. */
  nodeEnv: process.env.NODE_ENV || "development",

  /** Session / token secret (for future JWT use) */
  jwtSecret: process.env.JWT_SECRET || randomUUID(),
};
