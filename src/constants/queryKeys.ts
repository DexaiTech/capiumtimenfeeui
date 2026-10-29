/**
 * Query-key factories. Account-level keys start with 'me'; every key of practice data starts
 * with `['org', organizationId, …]`, so switching or leaving a practice can drop all of its
 * data with `queryKeys.org.all(id)`. Feature modules extend these with their own sub-keys
 * (for example `[...queryKeys.org.clients(id), 'list', filters]`).
 */
export const queryKeys = {
  /** Public deployment information (closed or open); no session needed. */
  system: () => ['system'] as const,
  me: () => ['me'] as const,
  sessions: () => ['me', 'sessions'] as const,
  /** The caller's practices with their role and permissions in each. */
  myOrganizations: () => ['me', 'organizations'] as const,
  /** Slug → practice lookup. Under the list key, so invalidating the list refreshes it too. */
  organizationBySlug: (slug: string) => ['me', 'organizations', 'by-slug', slug] as const,
  /** The permission catalogue is global, not tenant data. */
  permissions: () => ['permissions'] as const,

  org: {
    all: (organizationId: string) => ['org', organizationId] as const,
    detail: (organizationId: string) => ['org', organizationId, 'detail'] as const,
    members: (organizationId: string) => ['org', organizationId, 'members'] as const,
    roles: (organizationId: string) => ['org', organizationId, 'roles'] as const,
    auditLogs: (organizationId: string) => ['org', organizationId, 'audit-logs'] as const,
    // Keys reserved for the feature modules built next.
    clients: (organizationId: string) => ['org', organizationId, 'clients'] as const,
    jobs: (organizationId: string) => ['org', organizationId, 'jobs'] as const,
    time: (organizationId: string) => ['org', organizationId, 'time'] as const,
    timesheets: (organizationId: string) => ['org', organizationId, 'timesheets'] as const,
    wip: (organizationId: string) => ['org', organizationId, 'wip'] as const,
    invoices: (organizationId: string) => ['org', organizationId, 'invoices'] as const,
    creditNotes: (organizationId: string) => ['org', organizationId, 'credit-notes'] as const,
    payments: (organizationId: string) => ['org', organizationId, 'payments'] as const,
    debtors: (organizationId: string) => ['org', organizationId, 'debtors'] as const,
    statements: (organizationId: string) => ['org', organizationId, 'statements'] as const,
    reports: (organizationId: string) => ['org', organizationId, 'reports'] as const,
    rates: (organizationId: string) => ['org', organizationId, 'rates'] as const,
    settings: (organizationId: string) => ['org', organizationId, 'settings'] as const,
    dashboard: (organizationId: string) => ['org', organizationId, 'dashboard'] as const,
    // Team & Rates. `members` stays the V1 key that other features read; staff changes refresh both.
    staff: (organizationId: string) => ['org', organizationId, 'staff'] as const,
    grades: (organizationId: string) => ['org', organizationId, 'grades'] as const,
    rateRules: (organizationId: string) => ['org', organizationId, 'rate-rules'] as const,
    rateHistory: (organizationId: string) => ['org', organizationId, 'rate-history'] as const,
    rateReruns: (organizationId: string) => ['org', organizationId, 'rate-reruns'] as const,
    services: (organizationId: string) => ['org', organizationId, 'services'] as const,
    activityCodes: (organizationId: string) => ['org', organizationId, 'activity-codes'] as const,
    vatRates: (organizationId: string) => ['org', organizationId, 'vat-rates'] as const,
    // Client segments (Settings) and the staff linked to them.
    segments: (organizationId: string) => ['org', organizationId, 'segments'] as const,
    sequences: (organizationId: string) => ['org', organizationId, 'sequences'] as const,
    invoiceTemplates: (organizationId: string) =>
      ['org', organizationId, 'invoice-templates'] as const,
    // Notifications: the bell (own inbox), the settings and the email templates.
    notifications: (organizationId: string) => ['org', organizationId, 'notifications'] as const,
    notificationSettings: (organizationId: string) =>
      ['org', organizationId, 'notification-settings'] as const,
    emailTemplates: (organizationId: string) => ['org', organizationId, 'email-templates'] as const,
    // Settings: the period lock and its history, the onboarding checklist, staff/rates/jobs imports.
    periodLock: (organizationId: string) => ['org', organizationId, 'period-lock'] as const,
    onboarding: (organizationId: string) => ['org', organizationId, 'onboarding'] as const,
    dataImports: (organizationId: string) => ['org', organizationId, 'data-imports'] as const,
    // Application Testing: tickets (lists, details, comments, files, the dashboard) and their tags.
    tickets: (organizationId: string) => ['org', organizationId, 'tickets'] as const,
    ticketTags: (organizationId: string) => ['org', organizationId, 'ticket-tags'] as const,
    // Expenses: types, claims (lists, details, summary), receipts and the cached bytes of their files.
    expenses: (organizationId: string) => ['org', organizationId, 'expenses'] as const,
    disbursements: (organizationId: string) => ['org', organizationId, 'disbursements'] as const,
    // Billing: estimates and recurring invoice schedules (lists, details, runs).
    estimates: (organizationId: string) => ['org', organizationId, 'estimates'] as const,
    recurring: (organizationId: string) => ['org', organizationId, 'recurring'] as const,
  },
};
