import type { Organization } from '@/types/organization';

/**
 * The approval flows a practice can switch off in General Settings (ticket APT53). Off, the flow
 * is skipped: submitted timesheets and expense claims are approved at once, every WIP adjustment
 * takes effect at once and invoices are issued without approval. Whatever was waiting when a
 * switch went off is approved by the API there and then (unless a locked period stops it).
 */
export type ApprovalArea = 'timesheet' | 'expense' | 'wip_adjustment' | 'invoice';

export type ApprovalSwitches = Pick<
  Organization,
  | 'require_timesheet_approval'
  | 'expense_approval_required'
  | 'wip_adjustment_approval_required'
  | 'invoice_approval_required'
>;

/** Whether the practice approves this area. */
export function approvalOn(organization: ApprovalSwitches, area: ApprovalArea): boolean {
  switch (area) {
    case 'timesheet':
      return organization.require_timesheet_approval;
    case 'expense':
      return organization.expense_approval_required;
    case 'wip_adjustment':
      return organization.wip_adjustment_approval_required;
    case 'invoice':
      return organization.invoice_approval_required;
  }
}
