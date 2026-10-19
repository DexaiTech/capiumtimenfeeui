import type { BadgeTone } from '@/components/ui';

import type {
  CardStatus,
  IntegrationKey,
  ItemStatus,
  RetryOutcome,
  SyncStatus,
} from '../adminTypes';

export const INTEGRATION_NAMES: Record<IntegrationKey, string> = {
  central_client: 'Central Client',
  central_user: 'Central User',
  practice_management: 'Practice Management',
  bookkeeping: 'Bookkeeping',
};

export const INTEGRATION_KEYS = Object.keys(INTEGRATION_NAMES) as IntegrationKey[];

export const CARD_STATUS: Record<CardStatus, { label: string; tone: BadgeTone }> = {
  disabled: { label: 'Off', tone: 'grey' },
  ready: { label: 'Ready', tone: 'info' },
  connected: { label: 'Connected', tone: 'success' },
  error: { label: 'Needs attention', tone: 'danger' },
};

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Waiting', tone: 'warning' },
  ok: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'grey' },
};

export const LOG_STATUS: Record<SyncStatus, { label: string; tone: BadgeTone }> = {
  ok: { label: 'Worked', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'grey' },
};

/** The counts a card shows, by the key the API sends them under. */
export const SUMMARY_LABELS: Record<string, string> = {
  linked_clients: 'Linked clients',
  stale_clients: 'Out of date',
  failed_clients: 'Clients that failed',
  linked_jobs: 'Linked jobs',
  linked_tasks: 'Linked tasks',
  sent: 'Documents sent',
  skipped: 'Skipped',
};

const ENTITY_NAMES: Record<string, string> = {
  invoice: 'Invoice',
  credit_note: 'Credit note',
  job: 'Job',
  task: 'Task',
  member: 'Member',
  client: 'Client',
};

/** `credit_note` as "Credit note". */
export function entityName(type: string | null): string {
  if (!type) return '';
  return ENTITY_NAMES[type] ?? words(type);
}

/** `send_invoice` as "Send invoice". */
export function words(code: string): string {
  const text = code.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What a retried item came to, in a sentence for a toast. */
export const RETRY_OUTCOME: Record<
  RetryOutcome,
  { title: string; tone: 'success' | 'warning' | 'error' }
> = {
  sent: { title: 'Sent', tone: 'success' },
  retry_scheduled: { title: 'Failed again: it will be tried again', tone: 'warning' },
  failed: { title: 'Failed again: it needs a person', tone: 'error' },
  skipped: { title: 'Nothing to send', tone: 'success' },
  already_synced: { title: 'Already sent: nothing was sent twice', tone: 'success' },
};

/** The pattern of a bookkeeping account or tax code (`CODE_REGEX` of the API). */
export const MAPPING_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,19}$/;
