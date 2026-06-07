/**
 * REST client for the Ovatu booking API.
 *
 * Auth: Ovatu uses API-Key-based auth passed in a header.
 * Base URL is configurable via OVATU_API_BASE_URL env var.
 */

import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Types returned by Ovatu (minimal — extend as needed)
// ---------------------------------------------------------------------------

export interface OvatuAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  service_name?: string;
  staff_name?: string;
  customer_name?: string;
  customer_phone?: string;
  location_id?: string;
  location_name?: string;
  updated_at?: string;
}

export interface OvatuCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export interface OvatuLocation {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class OvatuClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? config.ovatuApiBaseUrl;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ovatu API ${res.status} on ${path}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  /** Fetch appointments with optional date filtering */
  async getAppointments(params?: {
    after?: string;   // ISO date string — only appointments modified after this
    limit?: number;
  }): Promise<OvatuAppointment[]> {
    let path = "/appointments";
    const qs: string[] = [];
    if (params?.after) qs.push(`after=${encodeURIComponent(params.after)}`);
    if (params?.limit) qs.push(`limit=${params.limit}`);
    if (qs.length) path += `?${qs.join("&")}`;

    return this.request<OvatuAppointment[]>(path);
  }

  /** Fetch a single appointment by ID */
  async getAppointment(id: string): Promise<OvatuAppointment> {
    return this.request<OvatuAppointment>(`/appointments/${id}`);
  }

  /** Fetch customers */
  async getCustomers(): Promise<OvatuCustomer[]> {
    return this.request<OvatuCustomer[]>("/customers");
  }

  /** Fetch locations */
  async getLocations(): Promise<OvatuLocation[]> {
    return this.request<OvatuLocation[]>("/locations");
  }
}
