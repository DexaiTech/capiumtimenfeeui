/**
 * Shapes of the central client service endpoints (`app/schemas/central_clients.py`,
 * `capiumtimenfeeapi/docs/modules/central-clients.md`). The central service is the Capium
 * group's master list of clients: a practice enables one to get a local client that follows the
 * central name and address.
 */
import type { IsoDateTime } from '@/types/api';

import type { CentralSyncState, ClientDetail } from '../types';

export interface MatchingClient {
  id: string;
  code: string;
  name: string;
}

/** A central client as the service (or this practice's cache of it) describes it. */
export interface CentralClient {
  central_id: string;
  name: string;
  /** Upper case, no spaces; null for sole traders. */
  company_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  /** `archived` centrally: it cannot be enabled or linked. */
  status: 'active' | 'archived';
  updated_at: IsoDateTime;
  /** When this practice's cache last heard of it; null when it was never cached. */
  fetched_at: IsoDateTime | null;
  /** A live client of this practice is linked to it. */
  enabled: boolean;
  client_id: string | null;
  client_code: string | null;
  /** An unlinked client with the same company number: enabling links that one instead. */
  matching_client: MatchingClient | null;
}

export interface CentralSearchResult {
  items: CentralClient[];
  /** `cache` while the central service is unavailable. */
  source: 'live' | 'cache';
  /** The items may be out of date. */
  stale: boolean;
}

/** `created` (201), or `linked_existing` / `already_enabled` (200). */
export type EnableOutcome = 'created' | 'linked_existing' | 'already_enabled';

export interface CentralEnabled {
  result: EnableOutcome;
  /** The central service was unavailable: the cached copy was used. */
  from_cache: boolean;
  client: ClientDetail;
}

/** The outcome of synchronising one linked client. */
export interface ClientSynced {
  client_id: string;
  code: string;
  name: string;
  central_id: string;
  state: Exclude<CentralSyncState, 'local'>;
  changed: boolean;
  /** Field → [old, new] for each field that changed. */
  changes: Record<string, Array<string | null>>;
  from_cache: boolean;
  message: string | null;
  synced_at: IsoDateTime | null;
}

export interface CentralSyncAll {
  /** The central service answered. */
  available: boolean;
  processed: number;
  synced: number;
  stale: number;
  failed: number;
  changed: number;
  /** Linked clients left for another call (a call handles at most 200). */
  remaining: number;
  results: ClientSynced[];
}
