import type { AuditLogEntry } from '../types';

type Metadata = Record<string, unknown>;

export interface ActionGroup {
  value: string;
  label: string;
  /** Sent as the `action` filter: a prefix ending in `.`. */
  prefix: string;
}

export const ACTION_GROUPS: ReadonlyArray<ActionGroup> = [
  { value: 'staff', label: 'Staff', prefix: 'member.' },
  { value: 'roles', label: 'Roles', prefix: 'role.' },
  { value: 'practice', label: 'Practice settings', prefix: 'organization.' },
  { value: 'clients', label: 'Clients', prefix: 'client.' },
  { value: 'jobs', label: 'Jobs', prefix: 'job.' },
  { value: 'timesheets', label: 'Timesheets', prefix: 'timesheet.' },
  { value: 'disbursements', label: 'Disbursements', prefix: 'disbursement.' },
  { value: 'wip', label: 'WIP', prefix: 'wip.' },
  { value: 'invoices', label: 'Invoices', prefix: 'invoice.' },
  { value: 'credit-notes', label: 'Credit notes', prefix: 'credit_note.' },
  { value: 'payments', label: 'Payments', prefix: 'payment.' },
  { value: 'rates', label: 'Rates', prefix: 'rate.' },
  { value: 'services', label: 'Services', prefix: 'service.' },
  { value: 'activity-codes', label: 'Activity codes', prefix: 'activity_code.' },
  { value: 'vat-rates', label: 'VAT rates', prefix: 'vat_rate.' },
  { value: 'numbering', label: 'Numbering', prefix: 'sequence.' },
  { value: 'tickets', label: 'Tickets', prefix: 'ticket.' },
  { value: 'ticket-comments', label: 'Ticket comments', prefix: 'ticket_comment.' },
  { value: 'ticket-files', label: 'Ticket files', prefix: 'ticket_attachment.' },
  { value: 'ticket-tags', label: 'Ticket tags', prefix: 'ticket_tag.' },
];

function isRecord(value: unknown): value is Metadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPath(metadata: Metadata, path: string): unknown {
  let current: unknown = metadata;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * The first non-empty text found at one of the dotted paths. The contract does not fix the
 * keys of `metadata`, so each sentence tries the plausible spellings and degrades to a
 * generic wording when none is present.
 */
function pickText(metadata: Metadata, paths: ReadonlyArray<string>): string | null {
  for (const path of paths) {
    const value = readPath(metadata, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

const MEMBER_PATHS = [
  'member_name',
  'full_name',
  'target_name',
  'member.full_name',
  'user.full_name',
  'member_email',
  'target_email',
  'member.email',
  'user.email',
];
const ROLE_PATHS = ['role_name', 'name', 'role.name', 'new.name', 'old.name', 'new_name'];
const member = (metadata: Metadata) => pickText(metadata, MEMBER_PATHS) ?? 'a member';
const possessive = (name: string) => (name === 'a member' ? "a member's" : `${name}’s`);
const role = (metadata: Metadata) => {
  const name = pickText(metadata, ROLE_PATHS);
  return name ? `the role “${name}”` : 'a role';
};
function roleChange(metadata: Metadata): string {
  const from = pickText(metadata, [
    'old_role_name',
    'old_role.name',
    'old.role_name',
    'old.role.name',
    'old.role',
    'from',
  ]);
  const to = pickText(metadata, [
    'new_role_name',
    'new_role.name',
    'new.role_name',
    'new.role.name',
    'new.role',
    'to',
  ]);
  const base = `Changed ${possessive(member(metadata))} role`;
  if (from && to) return `${base} from ${from} to ${to}`;
  if (to) return `${base} to ${to}`;
  return base;
}

function changedFields(metadata: Metadata): string[] {
  const raw = metadata.changed_fields ?? metadata.fields ?? metadata.changes ?? metadata.changed;
  const names = Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string')
    : isRecord(raw)
      ? Object.keys(raw)
      : [];
  return names.map(humanizeKey).map((name) => name.toLowerCase());
}

function permissionChange(metadata: Metadata): string {
  const count = (key: string) => {
    const value = metadata[key];
    return Array.isArray(value) ? value.length : null;
  };
  const added = count('added');
  const removed = count('removed');
  const base = `Changed the permissions of ${role(metadata)}`;
  if (added === null && removed === null) return base;
  const parts = [added ? `${added} added` : null, removed ? `${removed} removed` : null].filter(
    Boolean,
  );
  return parts.length > 0 ? `${base} (${parts.join(', ')})` : base;
}

const SENTENCES: Record<string, (metadata: Metadata) => string> = {
  'member.role_changed': roleChange,
  'member.suspended': (metadata) => `Suspended ${member(metadata)}`,
  'member.reactivated': (metadata) => `Reactivated ${member(metadata)}`,
  'member.removed': (metadata) => `Removed ${member(metadata)} from the practice`,
  'member.created': (metadata) => `Added ${member(metadata)} to the staff`,
  'member.password_reset': (metadata) => `Reset the password of ${member(metadata)}`,
  'role.created': (metadata) => `Created ${role(metadata)}`,
  'role.updated': (metadata) => `Updated ${role(metadata)}`,
  'role.permissions_changed': permissionChange,
  'role.deleted': (metadata) => `Deleted ${role(metadata)}`,
  'member.updated': (metadata) => `Updated the details of ${member(metadata)}`,
  'organization.created': () => 'Created the practice',
  'organization.deleted': () => 'Deleted the practice',
  'organization.updated': (metadata) => {
    const fields = changedFields(metadata);
    return fields.length > 0
      ? `Updated the practice settings (${fields.join(', ')})`
      : 'Updated the practice settings';
  },
};

/** What a financial record is called in a generic sentence: its number, else its name. */
const RECORD_PATHS = ['number', 'code', 'name', 'client_name', 'client.name', 'description'];

/** "invoice.issued" + {number: "INV-00012"} → "Invoice issued: INV-00012". */
function genericSentence(action: string, metadata: Metadata): string | null {
  const group = ACTION_GROUPS.find((entry) => action.startsWith(entry.prefix));
  if (!group) return null;
  const subject = humanizeKey(action.slice(0, group.prefix.length - 1));
  const verb = action.slice(group.prefix.length).replace(/[_.]+/g, ' ');
  const name = pickText(metadata, RECORD_PATHS);
  return name ? `${subject} ${verb}: ${name}` : `${subject} ${verb}`;
}

/** A readable sentence for a known action; the raw action code for anything else. */
export function describeAuditEntry(entry: Pick<AuditLogEntry, 'action' | 'metadata'>): string {
  const metadata = isRecord(entry.metadata) ? entry.metadata : {};
  const sentence = SENTENCES[entry.action];
  if (sentence) return sentence(metadata);
  return genericSentence(entry.action, metadata) ?? entry.action;
}

export function isKnownAction(action: string): boolean {
  return action in SENTENCES || ACTION_GROUPS.some((group) => action.startsWith(group.prefix));
}

/**
 * The text of an entry in the list: a sentence this page knows, else the wording the API sent
 * (`summary`, then `label`), else null: the raw action is shown.
 */
export function entryText(entry: AuditLogEntry): string | null {
  if (isKnownAction(entry.action)) return describeAuditEntry(entry);
  return entry.summary || entry.label || null;
}

/** `old_role_name` → "Old role name". */
export function humanizeKey(key: string): string {
  const words = key.replace(/[_.-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

/** Metadata values as plain text. Nested values are shown as compact JSON, never as markup. */
export function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value === '' ? '—' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' || typeof item === 'number')
  ) {
    return value.length > 0 ? value.join(', ') : '—';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '—';
  }
}

/** Start of the given calendar day (`YYYY-MM-DD`) in the browser's timezone, as an ISO timestamp. */
export function dayStartIso(date: string): string | undefined {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Last millisecond of the given calendar day, so a "to" date includes that whole day. */
export function dayEndIso(date: string): string | undefined {
  const parsed = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
