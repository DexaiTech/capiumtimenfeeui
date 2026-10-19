/**
 * The permission catalogue of the API (`app/core/permissions.py`). The UI gates navigation,
 * pages and actions on these codes, read from the practice context; the API checks every one
 * again. Routes and components check permissions, never role names.
 */
export const PERMISSIONS = {
  // Practice administration
  organizationRead: 'organization.read',
  organizationUpdate: 'organization.update',
  organizationDelete: 'organization.delete',
  memberRead: 'member.read',
  memberInvite: 'member.invite',
  memberUpdate: 'member.update',
  memberRemove: 'member.remove',
  roleRead: 'role.read',
  roleManage: 'role.manage',
  auditLogRead: 'audit_log.read',
  settingsManage: 'settings.manage',
  // Rates
  rateRead: 'rate.read',
  rateManage: 'rate.manage',
  // Clients
  clientRead: 'client.read',
  clientCreate: 'client.create',
  clientUpdate: 'client.update',
  clientDelete: 'client.delete',
  // Jobs
  jobRead: 'job.read',
  jobCreate: 'job.create',
  jobUpdate: 'job.update',
  jobDelete: 'job.delete',
  // Time
  timeLog: 'time.log',
  timeReadAll: 'time.read_all',
  timeManageAll: 'time.manage_all',
  timesheetApprove: 'timesheet.approve',
  // Disbursements
  disbursementLog: 'disbursement.log',
  disbursementManage: 'disbursement.manage',
  // WIP and billing
  wipRead: 'wip.read',
  wipWriteOff: 'wip.write_off',
  invoiceRead: 'invoice.read',
  invoiceCreate: 'invoice.create',
  invoiceIssue: 'invoice.issue',
  creditNoteCreate: 'credit_note.create',
  paymentRead: 'payment.read',
  paymentRecord: 'payment.record',
  // Reports
  reportRead: 'report.read',
  reportFinancial: 'report.financial',
  // Tickets (Application Testing)
  ticketRead: 'ticket.read',
  ticketCreate: 'ticket.create',
  ticketUpdate: 'ticket.update',
  ticketDelete: 'ticket.delete',
  // Period lock
  periodLockRead: 'period_lock.read',
  periodLockManage: 'period_lock.manage',
  periodLockReopen: 'period_lock.reopen',
  // Expenses
  expenseLog: 'expense.log',
  expenseReadAll: 'expense.read_all',
  expenseApprove: 'expense.approve',
  expenseManage: 'expense.manage',
  // More WIP and billing
  wipAdjust: 'wip.adjust',
  wipApprove: 'wip.approve',
  wipTransfer: 'wip.transfer',
  invoiceApprove: 'invoice.approve',
  estimateRead: 'estimate.read',
  estimateManage: 'estimate.manage',
  recurringRead: 'recurring.read',
  recurringManage: 'recurring.manage',
  openingBalanceImport: 'opening_balance.import',
  // Exports, integrations and data tools
  reportExport: 'report.export',
  auditLogExport: 'audit_log.export',
  integrationRead: 'integration.read',
  integrationManage: 'integration.manage',
  dataImportExport: 'data.import_export',
  onboardingManage: 'onboarding.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** System role keys (`SYSTEM_ROLES`). Only used for display and the Owner-only grant rule. */
export const OWNER_ROLE_KEY = 'owner';
