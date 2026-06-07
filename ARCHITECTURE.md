# Webhook Relay for Ovatu — Architecture

## Overview
A lightweight service that bridges Ovatu (no webhooks) → Zapier (webhook consumer).
Polls Ovatu's REST API for booking changes and fires HTTP webhooks to user-configured Zapier URLs.

## Stack
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js (lightweight REST API)
- **Database**: SQLite via Turso synced across team (shared team-db)
- **Polling**: In-process scheduler (node-cron or bull)
- **Frontend**: Simple dashboard (Vite + vanilla HTML/JS or React)
- **Hosting**: Self-hosted or cloud (containerized)

## Database Schema (SQLite)
```sql
-- Users / accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  api_key_hash TEXT NOT NULL,
  ovatu_api_key TEXT NOT NULL,         -- encrypted
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Webhook configurations per user
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,                   -- e.g., "New Booking → WhatsApp"
  url TEXT NOT NULL,                    -- Zapier webhook URL
  events TEXT NOT NULL,                 -- JSON array of event types to subscribe to
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Event types: new_booking, cancelled_booking, rescheduled_booking, check_in

-- Event log (tracks what we've already sent)
CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  webhook_id TEXT REFERENCES webhooks(id),
  ovatu_event_id TEXT,                  -- booking ID from Ovatu
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,                -- full booking data as JSON
  status TEXT DEFAULT 'pending',        -- pending, sent, failed
  response_status INTEGER,              -- HTTP status from webhook
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Ovatu API Integration
- Base URL: `https://api.ovatu.com/v1` (or appropriate)
- Auth: API Key in header
- Key endpoints needed:
  - `GET /appointments` — list bookings (with date filters)
  - `GET /customers` — customer details
  - `GET /locations` — location details
- Polling: Every 60 seconds, fetch appointments modified since last poll
- Detect change types: new booking (new ID), cancelled (status change), rescheduled (time change), check-in

## Webhook Payload Format (Zapier-compatible)
```json
{
  "event": "new_booking",
  "timestamp": "2024-01-01T12:00:00Z",
  "business": {
    "id": "loc_123",
    "name": "Salon Example"
  },
  "booking": {
    "id": "apt_456",
    "start_time": "2024-01-01T14:00:00Z",
    "end_time": "2024-01-01T15:00:00Z",
    "status": "confirmed",
    "service": "Haircut",
    "staff_name": "Jane",
    "customer_name": "John Doe",
    "customer_phone": "+1234567890"
  }
}
```

## API Endpoints
1. `POST /api/auth/signup` — Register with email + Ovatu API key
2. `POST /api/auth/login` — Login
3. `GET /api/webhooks` — List webhook configs
4. `POST /api/webhooks` — Create webhook config
5. `PUT /api/webhooks/:id` — Update webhook config
6. `DELETE /api/webhooks/:id` — Delete webhook config
7. `GET /api/events` — View event history
8. `GET /api/health` — Health check

## Frontend Pages
1. **Login/Signup** — Auth page
2. **Dashboard** — Overview of connected Ovatu + webhook activity
3. **Webhook Config** — Add/edit webhook targets + subscribe to event types
4. **Event Log** — History of events and delivery status

## Directory Structure
```
/opt/ovatu-relay/
├── server/                  # Backend
│   ├── src/
│   │   ├── index.ts         # Express entry point
│   │   ├── config.ts        # Environment config
│   │   ├── db/              # Database layer
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   │   ├── ovatu.ts     # Ovatu API client
│   │   │   ├── poller.ts    # Polling engine
│   │   │   ├── webhook.ts   # Webhook dispatcher
│   │   │   └── auth.ts      # Auth service
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # Dashboard (Vite + React)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   └── components/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── Dockerfile
└── README.md
```