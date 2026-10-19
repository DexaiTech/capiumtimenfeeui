import type { ComponentType } from 'react';

import type { ModuleId } from '@/constants/navigation';

export type PageModule = { default: ComponentType };

export type Loader = () => Promise<PageModule>;

/**
 * The file behind every page of the navigation (`constants/navigation.ts`): one chunk each.
 * A module's detail pages (a client, a job, an invoice) are listed in `DETAIL_ROUTES`.
 * Routing tests replace this module with stubs, so a page that stops being a placeholder
 * needs no change in them.
 */
export const PAGE_LOADERS: Record<ModuleId, Record<string, Loader>> = {
  dashboard: {
    overview: () => import('@/features/dashboard/pages/DashboardOverviewPage'),
    'my-actions': () => import('@/features/dashboard/pages/DashboardMyActionsPage'),
    'my-timesheet': () => import('@/features/dashboard/pages/DashboardMyTimesheetPage'),
    'pending-approvals': () => import('@/features/dashboard/pages/DashboardPendingApprovalsPage'),
    'missing-timesheets': () => import('@/features/dashboard/pages/DashboardMissingTimesheetsPage'),
    'top-clients-by-wip': () => import('@/features/dashboard/pages/DashboardTopClientsByWipPage'),
    'billing-trend': () => import('@/features/dashboard/pages/DashboardBillingTrendPage'),
    'debtor-ageing': () => import('@/features/dashboard/pages/DashboardDebtorAgeingPage'),
  },
  clients: {
    list: () => import('@/features/clients/pages/ClientsPage'),
    'client-360': () => import('@/features/clients/pages/Client360Page'),
  },
  time: {
    'my-timesheet': () => import('@/features/time/pages/MyTimesheetPage'),
    team: () => import('@/features/time/pages/TeamTimesheetsPage'),
    approvals: () => import('@/features/time/pages/TimesheetApprovalsPage'),
    entries: () => import('@/features/time/pages/TimeEntriesPage'),
    analysis: () => import('@/features/time/pages/TimeAnalysisPage'),
  },
  jobs: {
    list: () => import('@/features/jobs/pages/JobsPage'),
    'job-details': () => import('@/features/jobs/pages/JobDetailsPage'),
    tasks: () => import('@/features/jobs/pages/TasksPage'),
    assignments: () => import('@/features/jobs/pages/AssignmentsPage'),
    calendar: () => import('@/features/jobs/pages/JobCalendarPage'),
    budgets: () => import('@/features/jobs/pages/BudgetTrackingPage'),
  },
  expenses: {
    claims: () => import('@/features/expenses/pages/ExpenseClaimsPage'),
    disbursements: () => import('@/features/expenses/pages/DisbursementsPage'),
    types: () => import('@/features/expenses/pages/ExpenseTypesPage'),
    mine: () => import('@/features/expenses/pages/MyExpensesPage'),
    approvals: () => import('@/features/expenses/pages/ExpenseApprovalsPage'),
    receipts: () => import('@/features/expenses/pages/ReceiptsPage'),
  },
  wip: {
    summary: () => import('@/features/wip/pages/WipSummaryPage'),
    details: () => import('@/features/wip/pages/WipDetailsPage'),
    ageing: () => import('@/features/wip/pages/WipAgeingPage'),
    adjustments: () => import('@/features/wip/pages/WipAdjustmentsPage'),
    transfers: () => import('@/features/wip/pages/WipTransfersPage'),
    historic: () => import('@/features/wip/pages/HistoricWipPage'),
  },
  billing: {
    prepare: () => import('@/features/billing/pages/PrepareInvoicePage'),
    invoices: () => import('@/features/billing/pages/InvoicesPage'),
    'credit-notes': () => import('@/features/billing/pages/CreditNotesPage'),
    recurring: () => import('@/features/billing/pages/RecurringInvoicesPage'),
    estimates: () => import('@/features/billing/pages/EstimatesPage'),
    payments: () => import('@/features/billing/pages/PaymentsPage'),
    debtors: () => import('@/features/billing/pages/DebtorsPage'),
    statements: () => import('@/features/billing/pages/ClientStatementsPage'),
  },
  reports: {
    'time-analysis': () => import('@/features/time/pages/TimeAnalysisPage'),
    utilisation: () => import('@/features/reports/pages/UtilisationReportPage'),
    'job-profitability': () => import('@/features/reports/pages/JobProfitabilityReportPage'),
    'wip-ageing': () => import('@/features/reports/pages/WipAgeingReportPage'),
    recovery: () => import('@/features/reports/pages/RecoveryReportPage'),
    billing: () => import('@/features/reports/pages/BillingReportPage'),
    expenses: () => import('@/features/reports/pages/ExpensesReportPage'),
    'aged-debtors': () => import('@/features/reports/pages/AgedDebtorsReportPage'),
    payments: () => import('@/features/reports/pages/PaymentsReportPage'),
    'missing-timesheets': () => import('@/features/reports/pages/MissingTimesheetsReportPage'),
  },
  team: {
    staff: () => import('@/features/team/pages/StaffMembersPage'),
    grades: () => import('@/features/team/pages/GradesPage'),
    'cost-rates': () => import('@/features/team/pages/CostRatesPage'),
    'charge-out-rates': () => import('@/features/team/pages/ChargeOutRatesPage'),
    services: () => import('@/features/team/pages/ServicesPage'),
    'activity-types': () => import('@/features/team/pages/ActivityTypesPage'),
    'rate-history': () => import('@/features/team/pages/RateHistoryPage'),
    'rate-preview': () => import('@/features/team/pages/RatePreviewPage'),
    're-rate': () => import('@/features/team/pages/ReRateTimePage'),
  },
  settings: {
    general: () => import('@/features/settings/pages/GeneralSettingsPage'),
    practice: () => import('@/features/settings/pages/PracticeSettingsPage'),
    roles: () => import('@/features/settings/pages/RolesSettingsPage'),
    'period-lock': () => import('@/features/settings/pages/PeriodLockPage'),
    'vat-codes': () => import('@/features/settings/pages/VatCodesPage'),
    'document-numbering': () => import('@/features/settings/pages/DocumentNumberingPage'),
    'invoice-templates': () => import('@/features/settings/pages/InvoiceTemplatesPage'),
    notifications: () => import('@/features/settings/pages/NotificationSettingsPage'),
    'email-templates': () => import('@/features/settings/pages/EmailTemplatesPage'),
    integrations: () => import('@/features/settings/pages/IntegrationsPage'),
    'import-export': () => import('@/features/settings/pages/ImportExportPage'),
    onboarding: () => import('@/features/settings/pages/OnboardingChecklistPage'),
    'audit-logs': () => import('@/features/settings/pages/AuditLogSettingsPage'),
  },
};

/**
 * Pages below a module's pages that are not in the navigation: one client, one job, one
 * invoice. They share the rule of the page they belong to.
 */
export const DETAIL_ROUTES: Partial<
  Record<ModuleId, Array<{ path: string; pageId: string; load: Loader }>>
> = {
  clients: [
    {
      path: ':clientId/*',
      pageId: 'client-360',
      load: () => import('@/features/clients/pages/ClientDetailPage'),
    },
  ],
  jobs: [
    {
      path: ':jobId',
      pageId: 'job-details',
      load: () => import('@/features/jobs/pages/JobDetailPage'),
    },
  ],
  expenses: [
    // One claim opens below the list it was opened from; each list has its own access rule.
    {
      path: 'mine/:claimId',
      pageId: 'mine',
      load: () => import('@/features/expenses/pages/ExpenseClaimDetailPage'),
    },
    {
      path: 'claims/:claimId',
      pageId: 'claims',
      load: () => import('@/features/expenses/pages/ExpenseClaimDetailPage'),
    },
    {
      path: 'approvals/:claimId',
      pageId: 'approvals',
      load: () => import('@/features/expenses/pages/ExpenseClaimDetailPage'),
    },
  ],
  billing: [
    {
      path: 'invoices/:invoiceId',
      pageId: 'invoices',
      load: () => import('@/features/billing/pages/InvoiceDetailPage'),
    },
  ],
};
