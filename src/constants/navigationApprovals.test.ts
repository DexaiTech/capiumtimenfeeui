import { describe, expect, it } from 'vitest';

import { testOrganization } from '@/test/orgFixtures';
import { approvalOn, type ApprovalSwitches } from '@/utils/approvals';

import { visibleModules } from './navigation';

const APPROVER = ['time.log', 'timesheet.approve', 'expense.approve', 'expense.log'];
const can = (code: string) => APPROVER.includes(code);

const switches = (overrides: Partial<ApprovalSwitches> = {}): ApprovalSwitches => ({
  require_timesheet_approval: true,
  expense_approval_required: true,
  wip_adjustment_approval_required: true,
  invoice_approval_required: false,
  ...overrides,
});

const labels = (moduleId: string, values?: ApprovalSwitches) =>
  visibleModules('acme', can, values)
    .find((entry) => entry.id === moduleId)
    ?.pages.map((page) => page.label) ?? [];

describe('approval switches (ticket APT53)', () => {
  it('reads each area from its own setting', () => {
    const off = switches({ expense_approval_required: false, invoice_approval_required: true });
    expect(approvalOn(off, 'timesheet')).toBe(true);
    expect(approvalOn(off, 'expense')).toBe(false);
    expect(approvalOn(off, 'wip_adjustment')).toBe(true);
    expect(approvalOn(off, 'invoice')).toBe(true);
    expect(approvalOn(testOrganization, 'timesheet')).toBe(true);
  });

  it('offers the approval pages while the practice approves', () => {
    expect(labels('time', switches())).toContain('Timesheet Approvals');
    expect(labels('expenses', switches())).toContain('Expense Approvals');
    expect(labels('dashboard', switches())).toContain('Pending Approvals');
  });

  it('hides the approval pages of an area that is switched off', () => {
    const noTime = switches({ require_timesheet_approval: false });
    expect(labels('time', noTime)).not.toContain('Timesheet Approvals');
    expect(labels('time', noTime)).toContain('Team Timesheets');
    expect(labels('expenses', noTime)).toContain('Expense Approvals');
    // Pending Approvals still has the expense claims.
    expect(labels('dashboard', noTime)).toContain('Pending Approvals');

    const none = switches({ require_timesheet_approval: false, expense_approval_required: false });
    expect(labels('expenses', none)).not.toContain('Expense Approvals');
    expect(labels('dashboard', none)).not.toContain('Pending Approvals');
  });

  it('keeps every page when the switches are not known', () => {
    expect(labels('time')).toContain('Timesheet Approvals');
  });
});
