import type {
  IntegrationCard,
  IntegrationKey,
  Mappings,
  LockedPeriod,
  Onboarding,
  OnboardingStep,
  PeriodLock,
  PeriodLockEvent,
  PeriodLockSettings,
  SyncItem,
  SyncLogEntry,
} from '../adminTypes';

export const ADA = '0198c1f2-0000-7000-8000-000000000001';

/* ------------------------------- Period lock ------------------------------- */

export const lockEvent = (overrides: Partial<PeriodLockEvent> = {}): PeriodLockEvent => ({
  id: 'ev-1',
  event_type: 'locked',
  period_type: 'month',
  period_start: '2026-01-01',
  period_end: '2026-01-31',
  period_label: 'January 2026',
  previous_locked_through: null,
  locked_through: null,
  reason: 'January VAT return filed',
  actor_user_id: ADA,
  actor_name: 'Ada Lovelace',
  created_at: '2026-02-02T09:30:00Z',
  ...overrides,
});

/** The newest event of the history: Q2 was locked. */
export const q2Event = (): PeriodLockEvent =>
  lockEvent({
    id: 'ev-4',
    period_type: 'quarter',
    period_start: '2026-04-01',
    period_end: '2026-06-30',
    period_label: 'Q2 2026',
    reason: 'Q2 VAT return filed',
    created_at: '2026-07-10T14:00:00Z',
  });

/** Four events, newest first: January locked, March locked then unlocked, Q2 locked. */
export const historyOf = (): PeriodLockEvent[] => [
  q2Event(),
  lockEvent({
    id: 'ev-3',
    event_type: 'reopened',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    period_label: 'March 2026',
    reason: 'Late invoice from the supplier',
    created_at: '2026-04-10T14:00:00Z',
  }),
  lockEvent({
    id: 'ev-2',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    period_label: 'March 2026',
    reason: 'March VAT return filed',
    created_at: '2026-04-02T09:30:00Z',
  }),
  lockEvent(),
];

export const lockedPeriod = (overrides: Partial<LockedPeriod> = {}): LockedPeriod => ({
  id: 'lp-jan',
  period_type: 'month',
  start_date: '2026-01-01',
  end_date: '2026-01-31',
  label: 'January 2026',
  reason: 'January VAT return filed',
  locked_by: ADA,
  locked_by_name: 'Ada Lovelace',
  locked_at: '2026-02-02T09:30:00Z',
  ...overrides,
});

/** January 2026 and Q2 2026 are locked; February and March are open. */
export const PERIODS: LockedPeriod[] = [
  lockedPeriod(),
  lockedPeriod({
    id: 'lp-q2',
    period_type: 'quarter',
    start_date: '2026-04-01',
    end_date: '2026-06-30',
    label: 'Q2 2026',
    reason: 'Q2 VAT return filed',
    locked_at: '2026-07-10T14:00:00Z',
  }),
];

/** A practice that locks by the month in a calendar year, which it has set up. */
export const SETTINGS: PeriodLockSettings = {
  granularity: 'monthly',
  financial_year_start_month: 1,
  financial_year_start_day: 1,
  configured: true,
};

export const lockedWith = (
  periods: LockedPeriod[],
  last: PeriodLockEvent,
  settings: PeriodLockSettings = SETTINGS,
): PeriodLock => ({
  settings,
  periods,
  last_event: last,
});

export const NOT_LOCKED: PeriodLock = { settings: SETTINGS, periods: [], last_event: null };

/* -------------------------------- Onboarding -------------------------------- */

export const step = (key: string, overrides: Partial<OnboardingStep> = {}): OnboardingStep => ({
  key,
  title: key,
  description: '',
  state: 'todo',
  source: 'auto',
  detected: false,
  detail: null,
  link: '/settings/practice',
  updated_by_name: null,
  updated_at: null,
  ...overrides,
});

const summaryOf = (steps: OnboardingStep[]): Onboarding['summary'] => {
  const done = steps.filter((entry) => entry.state === 'done').length;
  const skipped = steps.filter((entry) => entry.state === 'skipped').length;
  const total = steps.length;
  return {
    total,
    done,
    skipped,
    todo: total - done - skipped,
    percent: total === 0 ? 0 : Math.round(((done + skipped) / total) * 100),
    complete: done + skipped === total,
  };
};

export const withSummary = (steps: OnboardingStep[]): Onboarding => ({
  steps,
  summary: summaryOf(steps),
});

export const onboardingSteps = (): OnboardingStep[] => [
  step('practice_details', {
    title: 'Complete the practice details',
    description: 'Address, postcode and a contact email or phone.',
    state: 'done',
    detected: true,
    link: '/settings/practice',
  }),
  step('invite_staff', {
    title: 'Add your staff',
    description: 'Invite the people who will record time.',
    detail: '1 active staff member',
    link: '/team/staff',
  }),
  step('review_vat', {
    title: 'Review the VAT codes',
    description: 'Check the rates match how you charge.',
    detected: null,
    source: 'manual',
    link: '/settings/vat-codes',
  }),
  step('first_client', {
    title: 'Add your first client',
    description: 'Add a client or import a list.',
    state: 'skipped',
    source: 'manual',
    detected: false,
    updated_by_name: 'Ada Lovelace',
    updated_at: '2026-10-17T09:00:00Z',
    link: '/clients',
  }),
];

/* ------------------------------- Integrations ------------------------------- */

export const card = (
  key: IntegrationKey,
  overrides: Partial<IntegrationCard> = {},
): IntegrationCard => ({
  key,
  name: key,
  description: '',
  phase: null,
  enabled: true,
  always_on: false,
  status: 'connected',
  last_success_at: '2026-10-18T09:00:00Z',
  last_attempt_at: '2026-10-18T09:00:00Z',
  last_error: null,
  pending_items: 0,
  failed_items: 0,
  config: {},
  summary: {},
  mock: null,
  ...overrides,
});

export const cardsOf = (): IntegrationCard[] => [
  card('central_client', {
    name: 'Central Client',
    description: "The group's master list of clients.",
    always_on: true,
    summary: { linked_clients: 12, stale_clients: 1, failed_clients: 0 },
  }),
  card('central_user', {
    name: 'Central User',
    description: "The group's directory of users.",
    status: 'ready',
    last_success_at: null,
    last_attempt_at: null,
  }),
  card('practice_management', {
    name: 'Practice Management',
    description: 'Jobs and tasks come from practice management.',
    phase: '2A',
    enabled: false,
    status: 'disabled',
    last_success_at: null,
    last_attempt_at: null,
    config: { sync_statuses: true },
    summary: { linked_jobs: 0, linked_tasks: 0 },
  }),
  card('bookkeeping', {
    name: 'Bookkeeping',
    description: 'Issued invoices and credit notes are sent to bookkeeping.',
    phase: '2B',
    status: 'error',
    last_error: 'Services without an income account: Audit',
    pending_items: 1,
    failed_items: 2,
    config: { send_invoices: true, send_credit_notes: true, send_from: null },
    summary: { sent: 7, skipped: 0 },
    mock: { available: true },
  }),
];

export const syncItem = (id: string, overrides: Partial<SyncItem> = {}): SyncItem => ({
  id,
  integration: 'bookkeeping',
  entity_type: 'invoice',
  entity_id: `inv-${id}`,
  label: `INV-${id}`,
  direction: 'outbound',
  operation: 'send_invoice',
  status: 'failed',
  attempts: 5,
  max_attempts: 5,
  next_attempt_at: null,
  last_attempt_at: '2026-10-18T09:00:00Z',
  completed_at: null,
  last_error: 'Service Audit has no income account.',
  last_error_code: 'UNMAPPED',
  external_ref: null,
  created_at: '2026-10-17T09:00:00Z',
  updated_at: '2026-10-18T09:00:00Z',
  ...overrides,
});

export const itemsOf = (): SyncItem[] => [
  syncItem('0001'),
  syncItem('0002', { entity_type: 'credit_note', label: 'CN-0002', operation: 'send_credit_note' }),
  syncItem('0003', {
    status: 'ok',
    attempts: 1,
    last_error: null,
    last_error_code: null,
    external_ref: 'BK-77',
    completed_at: '2026-10-17T09:05:00Z',
  }),
  syncItem('0004', {
    status: 'pending',
    attempts: 2,
    next_attempt_at: '2026-10-18T12:00:00Z',
    last_error: 'The bookkeeping system did not answer.',
    last_error_code: 'UNAVAILABLE',
  }),
];

export const logEntry = (id: string, overrides: Partial<SyncLogEntry> = {}): SyncLogEntry => ({
  id,
  integration: 'central_client',
  direction: 'inbound',
  operation: 'sync',
  entity_type: 'client',
  entity_id: `client-${id}`,
  external_id: `central-${id}`,
  status: 'ok',
  message: 'Client updated from the central service.',
  attempt: 1,
  created_at: '2026-10-18T08:00:00Z',
  ...overrides,
});

export const logsOf = (): SyncLogEntry[] => [
  logEntry('l1'),
  logEntry('l2', {
    status: 'failed',
    operation: 'poll',
    entity_type: null,
    entity_id: null,
    message: 'The central service did not answer.',
    attempt: 2,
  }),
  logEntry('l3', { status: 'skipped', operation: 'event', message: 'Event already processed.' }),
];

export const mappingsOf = (): Mappings => ({
  services: [
    {
      service_id: null,
      code: null,
      name: null,
      is_active: null,
      account_code: '4000',
      account_name: 'Sales',
    },
    {
      service_id: 'svc-audit',
      code: 'AUD',
      name: 'Audit',
      is_active: true,
      account_code: null,
      account_name: null,
    },
    {
      service_id: 'svc-books',
      code: 'BK',
      name: 'Bookkeeping',
      is_active: true,
      account_code: '4010',
      account_name: 'Bookkeeping income',
    },
  ],
  vat_rates: [
    {
      vat_rate_id: null,
      code: null,
      name: null,
      rate_bp: null,
      is_archived: null,
      tax_code: 'NONE',
      tax_name: null,
    },
    {
      vat_rate_id: 'vat-std',
      code: 'standard',
      name: 'Standard 20%',
      rate_bp: 2000,
      is_archived: false,
      tax_code: null,
      tax_name: null,
    },
  ],
  unmapped_services: 1,
  unmapped_vat_rates: 1,
});
