import type { ToastTone } from '@/components/ui';
import { formatUkDate, todayInZone } from '@/utils/dates';

import type { ClientRead } from '../types';
import type { CentralClient, CentralEnabled, CentralSyncAll, ClientSynced } from './types';

export type CentralTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface CentralChipInfo {
  label: string;
  tone: CentralTone;
  /** What the state means, for a tooltip and assistive technology. */
  title: string;
}

/**
 * The central chip of a client: `Local` (created in this practice), `Synced <date>` or `Linked`
 * (name and address confirmed against the central service), `Stale` (the service was
 * unavailable) and `Not found centrally`.
 */
export function centralChip(
  client: Pick<ClientRead, 'central_client_id' | 'central_sync_state' | 'central_synced_at'>,
  timeZone: string,
): CentralChipInfo {
  switch (client.central_sync_state) {
    case 'synced': {
      const confirmed = client.central_synced_at
        ? formatUkDate(todayInZone(timeZone, new Date(client.central_synced_at)))
        : '';
      return {
        label: confirmed ? `Synced ${confirmed}` : 'Linked',
        tone: 'success',
        title: 'Linked to the Capium central client service: name and address are managed there.',
      };
    }
    case 'stale':
      return {
        label: 'Stale',
        tone: 'warning',
        title:
          'Linked to the central client service, which was unavailable at the last synchronisation: the name and address may be out of date.',
      };
    case 'failed':
      return {
        label: 'Not found centrally',
        tone: 'danger',
        title: 'The central client service no longer knows this client.',
      };
    case 'local':
      return {
        label: 'Local',
        tone: 'neutral',
        title: 'Created in this practice: not linked to the central client service.',
      };
  }
}

/** A client linked to a central client (a merged-away client keeps its link). */
export const isLinked = (client: Pick<ClientRead, 'central_client_id'>) =>
  client.central_client_id !== null;

/** Merged-away clients are read-only history: nothing is synchronised, edited or restored. */
export const isMergedAway = (client: Pick<ClientRead, 'merged_into_client_id'>) =>
  client.merged_into_client_id !== null;

/** Only a linked client that was not merged away can be synchronised. */
export const canSync = (client: Pick<ClientRead, 'central_client_id' | 'merged_into_client_id'>) =>
  isLinked(client) && !isMergedAway(client);

/** Why the name and address of a linked client cannot be edited. */
export const MANAGED_MESSAGE = 'Managed by the Capium central client service';

/** The form fields a 409 `CLIENT_FIELD_MANAGED_CENTRALLY` names in its `details`. */
export function managedFields(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((entry: unknown) =>
    typeof entry === 'object' &&
    entry !== null &&
    'field' in entry &&
    typeof entry.field === 'string'
      ? [entry.field]
      : [],
  );
}

/** The address of a central client on one line. */
export function centralAddress(client: CentralClient): string {
  return [client.address_line1, client.address_line2, client.city, client.postcode]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

export interface Notice {
  tone: ToastTone;
  title: string;
  description?: string;
}

/** What a synchronisation of one client says, as a toast. */
export function describeSync(result: ClientSynced): Notice {
  const message = result.message ?? undefined;
  switch (result.state) {
    case 'synced':
      return result.changed
        ? {
            tone: 'success',
            title: 'Synchronised with central',
            description: `${result.name}: ${message ?? 'Name and address updated.'}`,
          }
        : { tone: 'success', title: 'Already up to date', description: result.name };
    case 'stale':
      return {
        tone: 'warning',
        title: 'Central service unavailable',
        description: message ?? 'The stored name and address were kept.',
      };
    case 'failed':
      return {
        tone: 'error',
        title: 'Not found centrally',
        description: message ?? 'The central service no longer knows this client.',
      };
  }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What "Sync all linked" says, as a toast. */
export function describeSyncAll(result: CentralSyncAll): Notice {
  if (result.processed === 0) {
    return { tone: 'info', title: 'No linked clients to synchronise' };
  }
  if (!result.available) {
    return {
      tone: 'warning',
      title: 'Central service unavailable',
      description: `${plural(result.processed, 'linked client was', 'linked clients were')} kept as they are and marked stale.`,
    };
  }
  const parts = [
    `${plural(result.changed, 'client', 'clients')} changed`,
    result.failed > 0 ? `${result.failed} not found centrally` : null,
    result.remaining > 0 ? `${result.remaining} left: synchronise again` : null,
  ].filter((part): part is string => part !== null);
  return {
    tone: result.failed > 0 ? 'warning' : 'success',
    title: `Synchronised ${result.synced} of ${plural(result.processed, 'linked client', 'linked clients')}`,
    description: `${parts.join(' · ')}.`,
  };
}

/** What enabling a central client did, as a toast. */
export function describeEnabled(enabled: CentralEnabled): Notice {
  const { client, result, from_cache: fromCache } = enabled;
  const who = `${client.name} (${client.code})`;
  const cached = fromCache ? ' The central service was unavailable: cached details were used.' : '';
  switch (result) {
    case 'created':
      return {
        tone: fromCache ? 'warning' : 'success',
        title: 'Client created',
        description: `${who} was added to this practice.${cached}`,
      };
    case 'linked_existing':
      return {
        tone: fromCache ? 'warning' : 'success',
        title: 'Linked to your existing client',
        description: `${who} now follows the central name and address.${cached}`,
      };
    case 'already_enabled':
      return {
        tone: 'info',
        title: 'Already enabled',
        description: `${who} is already in this practice.`,
      };
  }
}
