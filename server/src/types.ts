// ---------------------------------------------------------------------------
// Shared types for the Webhook Relay for Ovatu backend
// ---------------------------------------------------------------------------

/** The four event types the system detects */
export type EventType =
  | "new_booking"
  | "cancelled_booking"
  | "rescheduled_booking"
  | "check_in";

/** A registered user / business account */
export interface User {
  id: string;
  email: string;
  api_key_hash: string;
  ovatu_api_key: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A webhook configuration owned by a user */
export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  /** JSON array of event types the user wants to receive */
  events: string;
  active: number; // 0 | 1
  created_at: string;
  updated_at: string;
}

/** An event that was (or will be) dispatched */
export interface EventLog {
  id: string;
  user_id: string;
  webhook_id: string | null;
  ovatu_event_id: string | null;
  event_type: string;
  payload: string;
  status: "pending" | "sent" | "failed";
  response_status: number | null;
  sent_at: string | null;
  created_at: string;
}

/** Standard webhook payload sent to Zapier */
export interface WebhookPayload {
  event: EventType;
  timestamp: string;
  business: {
    id: string;
    name: string;
  };
  booking: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    service: string;
    staff_name: string;
    customer_name: string;
    customer_phone: string;
  };
}

/** Sign-up request body */
export interface SignupRequest {
  email: string;
  password: string;
  ovatu_api_key: string;
}

/** Login request body */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Create / update webhook request body */
export interface WebhookRequest {
  name: string;
  url: string;
  events: EventType[];
}
