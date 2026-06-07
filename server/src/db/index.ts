/**
 * Database layer for the Webhook Relay.
 *
 * ALL database operations go through the shared `team-db` CLI so that
 * the SQLite database is kept in sync with Turso across the team.
 *
 * IMPORTANT: Do NOT use sqlite3 directly — only team-db is safe.
 */

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync, rmSync } from "node:fs";
import type { EventLog, User, Webhook } from "../types.js";

// ---------------------------------------------------------------------------
// Low-level helper
// ---------------------------------------------------------------------------

/**
 * Execute a single SQL statement via `team-db` and return the JSON result.
 *
 * We write SQL to a temp file and read it back with `$(cat ...)` to avoid
 * shell escaping issues with special characters like `$` (in bcrypt hashes).
 */
function db(sql: string): unknown {
  try {
    const tmpFile = `/tmp/team-db-${randomUUID().slice(0, 8)}.sql`;
    writeFileSync(tmpFile, sql, "utf-8");
    const out = execSync(`team-db "$(cat ${tmpFile})"`, {
      encoding: "utf-8",
      timeout: 10_000,
    });
    rmSync(tmpFile, { force: true });
    return JSON.parse(out.trim());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`team-db error: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  api_key_hash TEXT NOT NULL,
  ovatu_api_key TEXT NOT NULL,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  webhook_id TEXT REFERENCES webhooks(id),
  ovatu_event_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  response_status INTEGER,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

/** Run schema migrations — safe to call on every boot (IF NOT EXISTS). */
export function migrate(): void {
  for (const stmt of SCHEMA_SQL.split(";")) {
    const trimmed = stmt.trim();
    if (trimmed) {
      db(trimmed);
    }
  }

  // Add last_checked_at column if it doesn't exist (migration for existing DBs)
  const cols = db("PRAGMA table_info(users)") as { name: string }[];
  const hasLastChecked = cols.some((c) => c.name === "last_checked_at");
  if (!hasLastChecked) {
    db("ALTER TABLE users ADD COLUMN last_checked_at TEXT");
    console.log("[db] added last_checked_at column to users");
  }

  console.log("[db] schema up-to-date");
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function findUserByEmail(email: string): User | null {
  const rows = db(
    `SELECT * FROM users WHERE email = '${email.replace(/'/g, "''")}'`
  ) as User[];
  return rows[0] ?? null;
}

export function findUserById(id: string): User | null {
  const rows = db(`SELECT * FROM users WHERE id = '${id}'`) as User[];
  return rows[0] ?? null;
}

export function createUser(
  email: string,
  apiKeyHash: string,
  ovatuApiKey: string
): User {
  const id = randomUUID();
  const safeEmail = email.replace(/'/g, "''");
  const safeHash = apiKeyHash.replace(/'/g, "''");
  const safeKey = ovatuApiKey.replace(/'/g, "''");
  db(
    `INSERT INTO users (id, email, api_key_hash, ovatu_api_key) VALUES ('${id}', '${safeEmail}', '${safeHash}', '${safeKey}')`
  );
  return findUserById(id)!;
}

/** Fetch all registered users. */
export function listAllUsers(): User[] {
  return db("SELECT * FROM users ORDER BY created_at ASC") as User[];
}

/** Update last_checked_at for a user to the current timestamp. */
export function updateLastCheckedAt(userId: string): void {
  db(`UPDATE users SET last_checked_at = datetime('now') WHERE id = '${userId}'`);
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export function listWebhooks(userId: string): Webhook[] {
  return db(
    `SELECT * FROM webhooks WHERE user_id = '${userId}' ORDER BY created_at DESC`
  ) as Webhook[];
}

export function findWebhookById(id: string): Webhook | null {
  const rows = db(
    `SELECT * FROM webhooks WHERE id = '${id}'`
  ) as Webhook[];
  return rows[0] ?? null;
}

export function createWebhook(
  userId: string,
  name: string,
  url: string,
  events: string[]
): Webhook {
  const id = randomUUID();
  const safeName = name.replace(/'/g, "''");
  const safeUrl = url.replace(/'/g, "''");
  const eventsJson = JSON.stringify(events);
  db(
    `INSERT INTO webhooks (id, user_id, name, url, events) VALUES ('${id}', '${userId}', '${safeName}', '${safeUrl}', '${eventsJson}')`
  );
  return findWebhookById(id)!;
}

export function updateWebhook(
  id: string,
  name: string,
  url: string,
  events: string[],
  active: number
): Webhook | null {
  const safeName = name.replace(/'/g, "''");
  const safeUrl = url.replace(/'/g, "''");
  const eventsJson = JSON.stringify(events);
  db(
    `UPDATE webhooks SET name = '${safeName}', url = '${safeUrl}', events = '${eventsJson}', active = ${active}, updated_at = datetime('now') WHERE id = '${id}'`
  );
  return findWebhookById(id);
}

export function deleteWebhook(id: string): void {
  db(`DELETE FROM webhooks WHERE id = '${id}'`);
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

export function listEvents(
  userId: string,
  limit = 50,
  offset = 0
): EventLog[] {
  return db(
    `SELECT * FROM event_log WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  ) as EventLog[];
}

export function createEventLog(
  userId: string,
  webhookId: string | null,
  ovatuEventId: string | null,
  eventType: string,
  payload: string
): EventLog {
  const id = randomUUID();
  const whId = webhookId ? `'${webhookId}'` : "NULL";
  const ovId = ovatuEventId ? `'${ovatuEventId}'` : "NULL";
  const safePayload = payload.replace(/'/g, "''");
  db(
    `INSERT INTO event_log (id, user_id, webhook_id, ovatu_event_id, event_type, payload) VALUES ('${id}', '${userId}', ${whId}, ${ovId}, '${eventType}', '${safePayload}')`
  );
  const rows = db(`SELECT * FROM event_log WHERE id = '${id}'`) as EventLog[];
  return rows[0];
}

export function updateEventStatus(
  id: string,
  status: "sent" | "failed",
  responseStatus: number | null
): void {
  const respStatus = responseStatus !== null ? responseStatus : "NULL";
  db(
    `UPDATE event_log SET status = '${status}', response_status = ${respStatus}, sent_at = datetime('now') WHERE id = '${id}'`
  );
}

/** Find event log entries for a given Ovatu booking ID (for deduplication). */
export function findEventsByOvatuId(ovatuEventId: string): EventLog[] {
  return db(
    `SELECT * FROM event_log WHERE ovatu_event_id = '${ovatuEventId}' ORDER BY created_at DESC`
  ) as EventLog[];
}