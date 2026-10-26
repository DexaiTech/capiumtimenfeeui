import { http } from 'msw';

import type { Organization, OrganizationContext } from '@/types/organization';

import { apiPath, fail, ok, server } from './server';

export const testOrganization: Organization = {
  id: '0198c1f2-0000-7000-8000-0000000000a1',
  name: 'Acme Accountants',
  slug: 'acme',
  timezone: 'Europe/London',
  week_start: 1,
  working_days: [1, 2, 3, 4, 5],
  minutes_per_day: 450,
  currency: 'GBP',
  vat_registered: true,
  vat_number: 'GB123456789',
  company_number: '01234567',
  payment_terms_days: 30,
  default_charge_rate: 9500,
  time_increment_minutes: 6,
  require_timesheet_approval: false,
  auto_approve_privileged_time: true,
  fixed_fee_wip_mode: 'on_completion',
  wip_adjustment_approval_threshold: 50000,
  wip_write_off_approval_threshold_percent: 1000,
  receipt_required_threshold: 2500,
  invoice_approval_required: false,
  invoice_approval_threshold: 0,
  payment_reminders_enabled: false,
  payment_reminder_days_after_due: 7,
  mileage_rate: 45,
  expense_markup_bp: 0,
  rate_mode: 'staff_first',
  email: 'hello@acme.example',
  phone: null,
  address_line1: '1 High Street',
  address_line2: null,
  city: 'London',
  postcode: 'EC1A 1AA',
  country: 'GB',
  bank_details: null,
  invoice_footer: null,
  created_at: '2026-10-01T09:00:00Z',
};

/** Every permission of the catalogue (`app/core/permissions.py`): the Owner role. */
export const OWNER_PERMISSIONS = [
  'organization.read',
  'organization.update',
  'organization.delete',
  'member.read',
  'member.invite',
  'member.update',
  'member.remove',
  'role.read',
  'role.manage',
  'audit_log.read',
  'settings.manage',
  'rate.read',
  'rate.manage',
  'client.read',
  'client.create',
  'client.update',
  'client.delete',
  'job.read',
  'job.create',
  'job.update',
  'job.delete',
  'time.log',
  'time.read_all',
  'time.manage_all',
  'timesheet.approve',
  'disbursement.log',
  'disbursement.manage',
  'wip.read',
  'wip.write_off',
  'invoice.read',
  'invoice.create',
  'invoice.issue',
  'credit_note.create',
  'payment.read',
  'payment.record',
  'report.read',
  'report.financial',
  'ticket.read',
  'ticket.create',
  'ticket.update',
  'ticket.delete',
  'period_lock.read',
  'period_lock.manage',
  'period_lock.reopen',
  'expense.log',
  'expense.read_all',
  'expense.approve',
  'expense.manage',
  'wip.adjust',
  'wip.approve',
  'wip.transfer',
  'invoice.approve',
  'estimate.read',
  'estimate.manage',
  'recurring.read',
  'recurring.manage',
  'opening_balance.import',
  'report.export',
  'audit_log.export',
  'integration.read',
  'integration.manage',
  'data.import_export',
  'onboarding.manage',
];

/** The system Staff role (it may raise and edit tickets, not delete them). */
export const STAFF_PERMISSIONS = [
  'organization.read',
  'member.read',
  'client.read',
  'job.read',
  'time.log',
  'disbursement.log',
  'report.read',
  'ticket.read',
  'ticket.create',
  'ticket.update',
  'expense.log',
];

export const ownerContext: OrganizationContext = {
  organization: testOrganization,
  role: { id: '0198c1f2-0000-7000-8000-0000000000b1', name: 'Owner', system_key: 'owner' },
  permissions: OWNER_PERMISSIONS,
};

/** A second practice in which the user is a plain member of staff. */
export const memberContext: OrganizationContext = {
  organization: {
    ...testOrganization,
    id: '0198c1f2-0000-7000-8000-0000000000a2',
    name: 'Globex Tax',
    slug: 'globex',
  },
  role: { id: '0198c1f2-0000-7000-8000-0000000000b2', name: 'Staff', system_key: 'staff' },
  permissions: STAFF_PERMISSIONS,
};

export function contextWith(
  permissions: string[],
  base: OrganizationContext = ownerContext,
): OrganizationContext {
  return { ...base, permissions };
}

/** Serves the list and the by-slug lookup the shell needs from one set of memberships. */
export function mockOrganizations(contexts: OrganizationContext[]): void {
  server.use(
    http.get(apiPath('/users/me/organizations'), () => ok(contexts)),
    http.get(apiPath('/organizations/by-slug/:slug'), ({ params }) => {
      const match = contexts.find((context) => context.organization.slug === params.slug);
      return match ? ok(match) : fail(404, 'RESOURCE_NOT_FOUND', 'Organization not found.');
    }),
  );
}
