import { testUser } from '@/test/fixtures';

import type { TaskTemplate } from '@/features/team';

import type { Assignee, CalendarEvent, Job, Member, Task } from '../types';

/** The practice and its people: Ada is the signed-in person. */
export const IDS = {
  acme: '0198c1f2-0000-7000-8000-0000000000c1',
  globex: '0198c1f2-0000-7000-8000-0000000000c2',
  ada: testUser.id,
  ben: '0198c1f2-0000-7000-8000-000000000002',
  cara: '0198c1f2-0000-7000-8000-000000000003',
  audit: '0198c1f2-0000-7000-8000-0000000000e1',
  bookkeeping: '0198c1f2-0000-7000-8000-0000000000e2',
  payroll: '0198c1f2-0000-7000-8000-0000000000e3',
} as const;

const member = (user_id: string, full_name: string, email: string): Member => ({
  user_id,
  full_name,
  email,
  initials: full_name
    .split(' ')
    .map((part) => part[0])
    .join(''),
  status: 'active',
});

export const ada = member(IDS.ada, 'Ada Lovelace', 'ada@example.com');
export const ben = member(IDS.ben, 'Ben Carter', 'ben@example.com');
export const cara = member(IDS.cara, 'Cara Diaz', 'cara@example.com');
export const members: Member[] = [ada, ben, cara];

export const clients = [
  { id: IDS.acme, code: 'ACME', name: 'Acme Ltd' },
  { id: IDS.globex, code: 'GLOB', name: 'Globex plc' },
];

export const services = [
  {
    id: IDS.audit,
    code: 'AUD',
    name: 'Audit',
    description: null,
    billing_basis: 'hourly',
    default_fee: null,
    default_billable: true,
    vat_rate_id: null,
    invoice_description: null,
    is_active: true,
    status: 'active',
    sort_order: 1,
    activity_code_ids: [],
    task_template_count: 0,
    is_used: false,
    can_delete: true,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
  },
  {
    id: IDS.bookkeeping,
    code: 'BK',
    name: 'Bookkeeping',
    description: null,
    billing_basis: 'fixed',
    default_fee: 120000,
    default_billable: true,
    vat_rate_id: null,
    invoice_description: null,
    is_active: true,
    status: 'active',
    sort_order: 2,
    activity_code_ids: [],
    task_template_count: 0,
    is_used: false,
    can_delete: true,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
  },
  {
    id: IDS.payroll,
    code: 'PAY',
    name: 'Payroll',
    description: null,
    billing_basis: 'hourly',
    default_fee: null,
    default_billable: true,
    vat_rate_id: null,
    invoice_description: null,
    is_active: true,
    status: 'active',
    sort_order: 3,
    activity_code_ids: [],
    task_template_count: 2,
    is_used: false,
    can_delete: true,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
  },
];

/** The default tasks of the Payroll service, by service id. */
export const payrollTemplates: TaskTemplate[] = [
  {
    id: 'tpl-1',
    title: 'Collect payroll inputs',
    description: null,
    budget_minutes: 60,
    due_offset_days: 2,
    sort_order: 0,
  },
  {
    id: 'tpl-2',
    title: 'Run the payroll',
    description: 'Process and send the payslips',
    budget_minutes: null,
    due_offset_days: null,
    sort_order: 1,
  },
];

/** A job as `GET /jobs/{id}` answers: in progress, hourly, with an hours budget of 40:00. */
export function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j-1',
    number: 'J00001',
    name: 'Year-end accounts',
    description: null,
    client_id: IDS.acme,
    client_code: 'ACME',
    client_name: 'Acme Ltd',
    service_id: null,
    service_name: null,
    status: 'in_progress',
    billing_basis: 'hourly',
    fixed_fee: null,
    hourly_rate: null,
    budget_minutes: 2400,
    budget_fee: null,
    period_start: null,
    period_end: null,
    start_date: '2026-10-01',
    due_date: '2026-10-30',
    partner_user_id: null,
    manager_user_id: IDS.ben,
    assignee_user_ids: [IDS.ada],
    completed_at: null,
    closed_at: null,
    pm_job_id: null,
    pm_linked_at: null,
    task_counts: { total: 0, completed: 0 },
    created_at: '2026-10-02T09:00:00Z',
    updated_at: '2026-10-02T09:00:00Z',
    logged_minutes: 600,
    billable_minutes: 600,
    time_value: 95000,
    wip_value: 95000,
    billed_value: 0,
    written_off_value: 0,
    budget_minutes_used_bp: 2500,
    budget_fee_used_bp: null,
    ...overrides,
  };
}

export const assignee = (user: Member): Assignee => ({
  user_id: user.user_id,
  full_name: user.full_name,
});

/** A task as `GET /jobs/{id}/tasks` answers. */
export function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    job_id: 'j-1',
    title: 'Prepare the trial balance',
    description: null,
    status: 'not_started',
    budget_minutes: null,
    logged_minutes: 0,
    budget_used_bp: null,
    due_date: null,
    is_overdue: false,
    sort_order: 0,
    completed_at: null,
    pm_task_id: null,
    assignees: [],
    created_by: IDS.ada,
    created_at: '2026-10-02T09:00:00Z',
    updated_at: '2026-10-02T09:00:00Z',
    ...overrides,
  };
}

export function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    type: 'job',
    id: 'j-1',
    job_id: 'j-1',
    job_number: 'J00001',
    title: 'Year-end accounts',
    client_id: IDS.acme,
    client_name: 'Acme Ltd',
    start: '2026-10-01',
    end: '2026-10-30',
    status: 'in_progress',
    due: '2026-10-30',
    assignees: [assignee(ada)],
    budget_used_bp: 2500,
    ...overrides,
  };
}
