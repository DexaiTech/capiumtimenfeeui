/**
 * Shapes of the lead endpoints (`app/schemas/leads.py`) behind Clients → Leads. Field names
 * mirror the Pydantic models exactly. Money is integer pence.
 */
import type { IsoDateTime, Pence } from '@/types/api';

import type { ClientRef, ClientType } from '../types';

export const LEAD_STATUSES = ['open', 'converted', 'archived'] as const;
/** Derived by the API: archived wins over converted, so an archived converted lead is archived. */
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** A prospective client and what winning it cost (`LeadRead`). */
export interface Lead {
  id: string;
  name: string;
  client_type: ClientType;
  /** The person the practice deals with; becomes the client's primary contact. */
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  /** Where the lead came from: "Referral", "Website", ... */
  source: string | null;
  notes: string | null;
  acquisition_cost: Pence;
  onboarding_cost: Pence;
  /** `acquisition_cost + onboarding_cost`. */
  total_cost: Pence;
  status: LeadStatus;
  archived_at: IsoDateTime | null;
  converted_at: IsoDateTime | null;
  converted_client_id: string | null;
  /** The client the lead became; null until converted, and once that client is deleted. */
  converted_client: ClientRef | null;
  created_by: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** The count and the costs of the leads of one status. */
export interface LeadTotals {
  count: number;
  acquisition_cost: Pence;
  onboarding_cost: Pence;
  total_cost: Pence;
}

/** `GET /leads/summary`. */
export type LeadSummary = Record<LeadStatus, LeadTotals>;

export interface LeadCreate {
  name: string;
  client_type?: ClientType;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
  acquisition_cost?: Pence;
  onboarding_cost?: Pence;
}

/** PATCH is partial; the text fields other than `name` take null to clear them. */
export type LeadUpdate = Partial<LeadCreate>;

/** `POST /leads/{id}/convert`: the client code, generated from the client sequence if left out. */
export interface LeadConvert {
  code?: string;
}

/** The list query: one status (default open) and an optional search. */
export interface LeadListParams {
  status: LeadStatus;
  q: string;
}
