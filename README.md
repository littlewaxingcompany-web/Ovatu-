# Ovatu Webhook Relay

Bridge Ovatu bookings to Zapier (or any HTTP webhook consumer).

Ovatu has no native webhook support, so you can't connect it to Zapier — no automated WhatsApp messages, no reminder flows, no post-appointment follow-ups. This service polls the Ovatu REST API for booking changes and fires configurable webhooks so you can finally automate your messaging workflows.

---

## Table of Contents

- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Webhook endpoints](#webhook-endpoints)
  - [Event log](#event-log)
  - [Health check](#health-check)
- [Environment variables](#environment-variables)
- [Webhook payload format](#webhook-payload-format)
- [Deployment](#deployment)
  - [Docker (recommended)](#docker-recommended)
  - [Manual](#manual)
- [Architecture](#architecture)
  - [Polling engine](#polling-engine)
  - [Change detection](#change-detection)
  - [Webhook dispatch](#webhook-dispatch)
- [Development](#development)
- [Tech stack](#tech-stack)

---

## How it works

```
┌─────────┐   polls every N sec    ┌──────────────────┐   fires HTTP POST   ┌─────────┐
│  Ovatu  │ ◄────────────────────── │  Webhook Relay   │ ──────────────────► │  Zapier │
│  REST   │   GET /appointments     │  (this service)  │   webhook payload   │  Webhook│
│  API    │                         │                  │                     │   URL   │
└─────────┘                         └──────────────────┘                     └─────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │   SQLite DB   │
                                   │ (via Turso)   │
                                   └──────────────┘
```

1. **Register** your Ovatu API key via the signup endpoint
2. **Configure** one or more webhook URLs (Zapier, Make, custom endpoints)
3. **Subscribe** to event types: `new_booking`, `cancelled_booking`, `rescheduled_booking`, `check_in`
4. The service **polls** Ovatu every N seconds and detects changes
5. When a change is detected, it **fires** a webhook to each matching URL

---

## Quick start

### Using Docker (recommended)

```bash
# Clone the repo
git clone <repo-url> ovatu-relay
cd ovatu-relay

# Start the server
docker compose up -d

# Check it's running
curl http://localhost:3001/api/health
```

### Manual (Node.js)

```bash
# Prerequisites: Node.js 20+, npm
cd server
npm install
npm run build
npm start
```

### Verify

```bash
# Health check
curl http://localhost:3001/api/health

# Create a user
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"salon@example.com","password":"your-password","ovatu_api_key":"your-ovatu-api-key"}'

# Add a webhook
curl -X POST http://localhost:3001/api/webhooks \
  -H "Content-Type: application/json" \
  -H "X-User-Email: salon@example.com" \
  -d '{"name":"WhatsApp Reminder","url":"https://hooks.zapier.com/hooks/catch/.../","events":["new_booking","cancelled_booking"]}'
```

---

## API Reference

All endpoints are prefixed with `/api`.

### Authentication

#### `POST /api/auth/signup`

Register a new user account.

**Request body:**

```json
{
  "email": "salon@example.com",
  "password": "your-secure-password",
  "ovatu_api_key": "your-ovatu-api-key"
}
```

**Response** `201 Created`:

```json
{
  "user": {
    "id": "uuid",
    "email": "salon@example.com",
    "last_checked_at": null,
    "created_at": "2026-01-01 12:00:00",
    "updated_at": "2026-01-01 12:00:00"
  }
}
```

**Errors:** `409 Conflict` if the email is already registered.

#### `POST /api/auth/login`

Authenticate an existing user.

**Request body:**

```json
{
  "email": "salon@example.com",
  "password": "your-secure-password"
}
```

**Response** `200 OK` — Same shape as signup response.

**Errors:** `401 Unauthorized` for invalid credentials.

### Webhook endpoints

All webhook endpoints require the `X-User-Email` header for auth.

#### `GET /api/webhooks`

List all webhook configurations for the authenticated user.

**Headers:** `X-User-Email: salon@example.com`

**Response:** Array of webhook objects with events parsed from JSON.

#### `POST /api/webhooks`

Create a new webhook configuration.

**Headers:** `X-User-Email: salon@example.com`

**Request body:**

```json
{
  "name": "WhatsApp Reminder",
  "url": "https://hooks.zapier.com/hooks/catch/.../",
  "events": ["new_booking", "cancelled_booking"]
}
```

Valid event types: `new_booking`, `cancelled_booking`, `rescheduled_booking`, `check_in`.

**Response** `201 Created`: The created webhook object.

#### `PUT /api/webhooks/:id`

Update an existing webhook. Ownership is enforced.

**Headers:** `X-User-Email: salon@example.com`

**Request body:** Same shape as POST. All fields are optional — only provided fields will be updated.

#### `DELETE /api/webhooks/:id`

Delete a webhook. Ownership is enforced.

**Headers:** `X-User-Email: salon@example.com`

**Response** `200 OK`: `{ "message": "Webhook deleted" }`

### Event log

#### `GET /api/events?limit=50&offset=0`

View the event history for the authenticated user.

**Headers:** `X-User-Email: salon@example.com`

**Query params:**
- `limit` (default: 50, max: 200)
- `offset` (default: 0)

**Response:** Array of event log objects with delivery status.

### Health check

#### `GET /api/health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "uptime": 123.45,
  "version": "0.1.0",
  "pollingIntervalSec": 60
}
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server bind address |
| `NODE_ENV` | `development` | Environment name |
| `OVATU_API_BASE_URL` | `https://api.ovatu.com/v1` | Ovatu API base URL |
| `POLLING_INTERVAL_SEC` | `60` | Seconds between Ovatu polls |
| `JWT_SECRET` | auto-generated | Secret for session tokens (set a stable value in production) |

---

## Webhook payload format

Every webhook POST carries this JSON payload:

```json
{
  "event": "new_booking",
  "timestamp": "2026-01-01T12:00:00Z",
  "business": {
    "id": "loc_123",
    "name": "Salon Example"
  },
  "booking": {
    "id": "apt_456",
    "start_time": "2026-01-01T14:00:00Z",
    "end_time": "2026-01-01T15:00:00Z",
    "status": "confirmed",
    "service": "Haircut",
    "staff_name": "Jane",
    "customer_name": "John Doe",
    "customer_phone": "+1234567890"
  }
}
```

### Event types

| Event | Trigger |
|---|---|
| `new_booking` | A new appointment was created in Ovatu |
| `cancelled_booking` | An appointment's status changed to cancelled |
| `rescheduled_booking` | An appointment's start/end time changed |
| `check_in` | An appointment's status changed to checked_in |

### Retry behaviour

Failed deliveries are retried up to 3 times with exponential backoff (1s, 2s, 4s). Delivery status is recorded in the event log.

---

## Deployment

### Docker (recommended)

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

Set environment variables via a `.env` file:

```env
# .env
PORT=3001
NODE_ENV=production
OVATU_API_BASE_URL=https://api.ovatu.com/v1
POLLING_INTERVAL_SEC=60
JWT_SECRET=your-strong-secret-here
```

### Manual

```bash
cd server
npm install
npm run build
NODE_ENV=production PORT=3001 npm start
```

### Production considerations

- **Database**: The service uses SQLite via the `team-db` CLI which syncs to Turso. No separate database server is needed.
- **Scaling**: For multiple instances, each instance polls independently. Consider using a shared Turso database if horizontal scaling is needed.
- **Security**: Use a strong `JWT_SECRET`. Keep the `ovatu_api_key` values secure.
- **Monitoring**: Use the `/api/health` endpoint for load balancer health checks (Docker HEALTHCHECK is pre-configured).

---

## Architecture

### Polling engine

The polling engine runs in-process using `setInterval`. On each tick:

1. Query all registered users from the database
2. For each user, create an `OvatuClient` with their stored API key
3. Fetch appointments modified since `last_checked_at` (or last 24h on first poll)
4. Process each appointment through the change detector
5. Dispatch webhooks for detected events
6. Update `last_checked_at` timestamp

A concurrency guard (`isPolling`) prevents overlapping poll cycles. Per-user error handling means one failed API call won't crash the whole cycle.

### Change detection

The service compares the current Ovatu booking state against previously stored `event_log` entries:

| Previous state | Current state | Event fired |
|---|---|---|
| Not seen before | Any | `new_booking` (or `cancelled_booking` if already cancelled) |
| Active status | `cancelled` | `cancelled_booking` |
| Any | `checked_in` / `checked in` | `check_in` |
| Active, time T1 | Active, time T2 | `rescheduled_booking` |

Events are always logged to the database for state tracking, even if no webhook subscribes to that event type.

### Webhook dispatch

On each detected event:
1. Log the raw event to `event_log` (with `webhook_id = NULL`) for state tracking
2. For each active webhook that subscribes to the event type, attempt HTTP POST delivery
3. Retry up to 3 times with exponential backoff (1s, 2s, 4s)
4. Record delivery status (`sent` / `failed`) and HTTP response status in the event log

---

## Development

```bash
# Clone
git clone <repo-url> ovatu-relay
cd ovatu-relay

# Install dependencies
cd server
npm install

# Run in dev mode (auto-restart on changes)
npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Run tests (when implemented)
npm test
```

The dev server runs on `http://localhost:3001` by default and watches for file changes via `tsx watch`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript 5 |
| Web framework | Express.js |
| Database | SQLite (via team-db CLI → Turso) |
| Password hashing | bcryptjs |
| Container | Docker + docker-compose |
| Polling | In-process setInterval |

---

## License

MIT