import type { Role } from '@/features/settings';
import { testUser } from '@/test/fixtures';
import { ownerContext, OWNER_PERMISSIONS } from '@/test/orgFixtures';

import type {
  ActivityType,
  ClientOption,
  Grade,
  JobOption,
  LadderStep,
  RateChange,
  RateResolution,
  RateRule,
  RerateEntry,
  ReratePreview,
  Rerun,
  RerunItem,
  Service,
  TaskTemplate,
  StaffDetail,
  StaffMember,
  VatCode,
} from '../types';

export { ownerContext, OWNER_PERMISSIONS, testUser };

const NOW = '2026-10-01T09:00:00Z';

/* ----------------------------------- Roles ----------------------------------- */

const role = (id: string, name: string, key: string | null, permissions: string[]): Role => ({
  id,
  name,
  system_key: key,
  description: null,
  is_system: key !== null,
  permissions,
  member_count: 1,
});

export const ownerRole = role('role-owner', 'Owner', 'owner', OWNER_PERMISSIONS);
export const adminRole = role(
  'role-admin',
  'Admin',
  'admin',
  OWNER_PERMISSIONS.filter((code) => code !== 'organization.delete'),
);
export const staffRole = role('role-staff', 'Staff', 'staff', [
  'organization.read',
  'member.read',
  'client.read',
  'time.log',
]);
export const testRoles: Role[] = [ownerRole, adminRole, staffRole];

const summary = (source: Role) => ({
  id: source.id,
  name: source.name,
  system_key: source.system_key,
});

/* ----------------------------------- Grades ---------------------------------- */

export const grade = (
  id: string,
  code: string,
  name: string,
  overrides: Partial<Grade> = {},
): Grade => ({
  id,
  code,
  name,
  description: null,
  default_cost_rate: null,
  default_charge_rate: null,
  default_chargeable_target_bp: 7500,
  is_active: true,
  sort_order: 0,
  staff_count: 0,
  can_delete: true,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

export const partnerGrade = grade('grade-partner', 'PTR', 'Partner', {
  default_cost_rate: 9000,
  default_charge_rate: 25000,
  default_chargeable_target_bp: 5000,
  sort_order: 10,
  staff_count: 1,
  can_delete: false,
});
export const seniorGrade = grade('grade-senior', 'SNR', 'Senior', {
  description: 'Runs engagements',
  default_cost_rate: 3000,
  default_charge_rate: 12000,
  sort_order: 20,
  staff_count: 2,
  can_delete: false,
});
export const juniorGrade = grade('grade-junior', 'JNR', 'Junior', {
  default_chargeable_target_bp: 8000,
  sort_order: 30,
  is_active: false,
});
export const testGrades: Grade[] = [partnerGrade, seniorGrade, juniorGrade];

const gradeRef = (source: Grade) => ({ id: source.id, code: source.code, name: source.name });

/* ------------------------------------ Staff ---------------------------------- */

export function staff(
  id: string,
  code: string,
  fullName: string,
  overrides: Partial<StaffMember> = {},
): StaffMember {
  return {
    id,
    code,
    full_name: fullName,
    email: `${fullName.split(' ')[0]?.toLowerCase() ?? 'x'}@example.com`,
    has_login: false,
    login_email: null,
    login_status: 'none',
    invited_at: null,
    status: 'active',
    is_selectable: true,
    grade: gradeRef(seniorGrade),
    approver: null,
    role: summary(staffRole),
    job_title: null,
    initials: null,
    working_minutes_per_day: 450,
    working_days: [1, 2, 3, 4, 5],
    weekly_capacity_minutes: 2250,
    chargeable_target_bp: 7500,
    start_date: '2026-01-05',
    leaving_date: null,
    charge_rate: 12000,
    charge_rate_source: 'grade',
    cost_rate: 3000,
    cost_rate_source: 'grade',
    joined_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

/** The signed-in user (`testUser`) is Ada, the Owner. */
export const ada = staff(testUser.id, 'S001', 'Ada Lovelace', {
  email: 'ada@example.com',
  has_login: true,
  login_email: 'ada@example.com',
  login_status: 'active',
  grade: gradeRef(partnerGrade),
  role: summary(ownerRole),
  job_title: 'Managing partner',
  initials: 'AL',
  chargeable_target_bp: 5000,
});
/** No login: a placeholder the practice records time for. */
export const sam = staff('staff-sam', 'S002', 'Sam Staff', {
  approver: { id: ada.id, full_name: ada.full_name },
  working_days: [1, 2, 3, 4],
  working_minutes_per_day: 420,
  weekly_capacity_minutes: 1680,
  chargeable_target_bp: 8000,
});
export const grace = staff('staff-grace', 'S003', 'Grace Hopper', {
  has_login: true,
  login_email: 'grace@example.com',
  login_status: 'active',
  role: summary(adminRole),
  approver: { id: ada.id, full_name: ada.full_name },
});
export const linus = staff('staff-linus', 'S004', 'Linus Torvalds', {
  status: 'inactive',
  has_login: true,
  login_email: 'linus@example.com',
  login_status: 'active',
  is_selectable: false,
});
export const margaret = staff('staff-margaret', 'S005', 'Margaret Hamilton', {
  status: 'left',
  leaving_date: '2026-09-30',
  is_selectable: false,
  grade: null,
});
export const ivy = staff('staff-ivy', 'S006', 'Ivy Invited', {
  has_login: true,
  login_email: 'ivy.login@example.com',
  login_status: 'invited',
  invited_at: '2026-10-10T09:00:00Z',
});
export const testStaff: StaffMember[] = [ada, sam, grace, linus, margaret, ivy];

export const detailOf = (
  member: StaffMember,
  overrides: Partial<StaffDetail> = {},
): StaffDetail => ({
  ...member,
  usage: [],
  can_delete: true,
  ...overrides,
});

/* ------------------------------------ Rates ---------------------------------- */

const ref = (id: string, code: string | null, name: string) => ({ id, code, name });

export const acme: ClientOption = { id: 'client-acme', code: 'C0001', name: 'Acme Ltd' };
export const globex: ClientOption = { id: 'client-globex', code: 'C0002', name: 'Globex Tax' };
export const testClients: ClientOption[] = [acme, globex];

export const accounts = ref('service-accounts', 'ACCS', 'Year-end accounts');

const LEVEL_LABEL: Record<RateRule['level'], string> = {
  client_service_staff: 'Client + service + staff',
  client_service: 'Client + service',
  client_staff: 'Client + staff',
  client: 'Client (everyone)',
  service_staff: 'Staff + service',
  service_grade: 'Service + grade',
  staff: 'Staff',
  grade: 'Grade',
};
const PRECEDENCE: Record<RateRule['level'], number> = {
  client_service_staff: 1,
  client_service: 2,
  client_staff: 3,
  client: 3,
  service_staff: 5,
  service_grade: 5,
  staff: 6,
  grade: 7,
};

export function rule(
  id: string,
  level: RateRule['level'],
  overrides: Partial<RateRule> = {},
): RateRule {
  return {
    id,
    kind: 'charge',
    level,
    level_label: LEVEL_LABEL[level],
    precedence: PRECEDENCE[level],
    client: null,
    service: null,
    staff: null,
    grade: null,
    rate: 15000,
    effective_from: '2026-01-01',
    effective_to: null,
    status: 'current',
    is_used: false,
    can_delete: true,
    created_by: ada.id,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

const samRef = { id: sam.id, code: sam.code, full_name: sam.full_name };

export const samChargeRule = rule('rule-sam', 'staff', {
  staff: samRef,
  rate: 17500,
  effective_from: '2026-03-01',
});
export const acmeServiceRule = rule('rule-acme-accounts', 'client_service', {
  client: ref(acme.id, acme.code, acme.name),
  service: accounts,
  rate: 20000,
  effective_from: '2026-06-01',
  effective_to: '2026-12-31',
  is_used: true,
  can_delete: false,
});
export const seniorGradeRule = rule('rule-senior', 'grade', {
  grade: gradeRef(seniorGrade),
  rate: 13000,
  effective_from: '2025-01-01',
  effective_to: '2025-12-31',
  status: 'ended',
});
export const futureRule = rule('rule-future', 'staff', {
  staff: samRef,
  rate: 19000,
  effective_from: '2027-01-01',
  status: 'future',
});
export const testChargeRules: RateRule[] = [
  samChargeRule,
  acmeServiceRule,
  seniorGradeRule,
  futureRule,
];

export const samCostRule = rule('rule-sam-cost', 'staff', {
  kind: 'cost',
  staff: samRef,
  rate: 3500,
  effective_from: '2026-03-01',
});
export const seniorCostRule = rule('rule-senior-cost', 'grade', {
  kind: 'cost',
  grade: gradeRef(seniorGrade),
  rate: 3200,
  effective_from: '2026-01-01',
  is_used: true,
  can_delete: false,
});
export const testCostRules: RateRule[] = [samCostRule, seniorCostRule];

/* ----------------------------- History and re-rating -------------------------- */

export const changeCreated: RateChange = {
  id: 'change-1',
  at: '2026-10-05T14:30:00Z',
  action: 'created',
  kind: 'charge',
  level: 'staff',
  level_label: 'Staff',
  rule_id: samChargeRule.id,
  client: null,
  service: null,
  staff: samRef,
  grade: null,
  old: null,
  new: { rate: 17500, effective_from: '2026-03-01', effective_to: null },
  actor_id: ada.id,
  actor_name: 'Ada Lovelace',
  source: 'rates',
};
export const changeEndDated: RateChange = {
  id: 'change-2',
  at: '2026-10-06T10:00:00Z',
  action: 'end_dated',
  kind: 'charge',
  level: 'client_service',
  level_label: 'Client + service',
  rule_id: acmeServiceRule.id,
  client: ref(acme.id, null, acme.name),
  service: ref(accounts.id, null, accounts.name),
  staff: null,
  grade: null,
  old: { rate: 20000, effective_from: '2026-06-01', effective_to: null },
  new: { rate: 20000, effective_from: '2026-06-01', effective_to: '2026-12-31' },
  actor_id: ada.id,
  actor_name: 'Ada Lovelace',
  source: 'rates',
};
export const changeGradeDefault: RateChange = {
  id: 'change-3',
  at: '2026-10-07T08:15:00Z',
  action: 'updated',
  kind: 'cost',
  level: 'grade',
  level_label: 'Grade',
  rule_id: null,
  client: null,
  service: null,
  staff: null,
  grade: ref(seniorGrade.id, null, seniorGrade.name),
  old: { rate: 3000, default: true },
  new: { rate: 3200, default: true },
  actor_id: ada.id,
  actor_name: 'Ada Lovelace',
  source: 'grade_default',
};
export const testChanges: RateChange[] = [changeCreated, changeEndDated, changeGradeDefault];

const step = (
  level: number | null,
  source: string,
  label: string,
  overrides: Partial<LadderStep> = {},
): LadderStep => ({
  level,
  source,
  label,
  applicable: true,
  reason: null,
  exists: false,
  rate: null,
  origin: null,
  rule: null,
  selected: false,
  ...overrides,
});

/** Sam on Acme's year-end accounts: the client + service rule wins; a staff rule also exists. */
export const resolution: RateResolution = {
  on_date: '2026-10-15',
  staff: samRef,
  client: ref(acme.id, acme.code, acme.name),
  service: accounts,
  job_id: null,
  grade: ref(seniorGrade.id, seniorGrade.code, seniorGrade.name),
  charge_rate: 20000,
  charge_source: 'client_service',
  charge_rule_id: acmeServiceRule.id,
  cost_rate: 3500,
  cost_source: 'staff',
  cost_rule_id: samCostRule.id,
  charge_ladder: [
    step(1, 'client_service_staff', 'Client + service + staff'),
    step(2, 'client_service', 'Client + service', {
      exists: true,
      rate: 20000,
      origin: 'rule',
      rule: { id: acmeServiceRule.id, effective_from: '2026-06-01', effective_to: '2026-12-31' },
      selected: true,
    }),
    step(3, 'client_staff', 'Client + staff'),
    step(4, 'job', 'Job rate', { applicable: false, reason: 'Choose a job to see its rate.' }),
    step(5, 'service_grade', 'Service + grade'),
    step(6, 'staff', 'Staff', {
      exists: true,
      rate: 17500,
      origin: 'rule',
      rule: { id: samChargeRule.id, effective_from: '2026-03-01', effective_to: null },
    }),
    step(7, 'grade', 'Grade', { exists: true, rate: 12000, origin: 'grade_default' }),
    step(null, 'default', 'Practice default rate', {
      exists: true,
      rate: 9500,
      origin: 'practice_default',
    }),
  ],
  cost_ladder: [
    step(null, 'staff', 'Staff cost rate', {
      exists: true,
      rate: 3500,
      origin: 'rule',
      rule: { id: samCostRule.id, effective_from: '2026-03-01', effective_to: null },
      selected: true,
    }),
    step(null, 'grade', 'Grade cost rate', { exists: true, rate: 3200, origin: 'grade_default' }),
    step(null, 'none', 'No cost rate', { exists: true, rate: 0, origin: 'none' }),
  ],
};

const entry = (id: string, overrides: Partial<RerateEntry> = {}): RerateEntry => ({
  entry_id: id,
  entry_date: '2026-09-07',
  minutes: 60,
  staff: samRef,
  client: ref(acme.id, acme.code, acme.name),
  job: ref('job-1', 'J00002', 'Year-end accounts'),
  outcome: 'change',
  skip_reason: null,
  old: { charge_rate: 6000, charge_value: 6000, cost_rate: 1000, cost_value: 1000, source: null },
  new: {
    charge_rate: 14500,
    charge_value: 14500,
    cost_rate: 1000,
    cost_value: 1000,
    source: 'client',
  },
  ...overrides,
});

export const previewEntry = entry('entry-1');
export const skippedEntry = entry('entry-2', {
  entry_date: '2026-09-08',
  outcome: 'skipped',
  skip_reason: 'period_locked',
});

export const preview: ReratePreview = {
  preview_token: 'token-abcdef-123456',
  expires_at: '2026-10-18T10:00:00Z',
  scope: {
    client_ids: [acme.id],
    job_ids: [],
    user_ids: [],
    date_from: '2026-09-01',
    date_to: '2026-09-30',
  },
  totals: {
    entries_examined: 1,
    entries_to_change: 1,
    entries_unchanged: 0,
    entries_skipped: 3,
    charge_value_before: 6000,
    charge_value_after: 14500,
    charge_value_delta: 8500,
    cost_value_before: 1000,
    cost_value_after: 1000,
    cost_value_delta: 0,
  },
  skipped: { billed: 1, in_draft: 1, written_off: 0, period_locked: 1 },
  items: [previewEntry, skippedEntry],
  items_truncated: false,
};

export const rerun: Rerun = {
  id: 'run-1',
  created_at: '2026-10-17T21:23:00Z',
  source: 'rerate',
  scope: {
    client_ids: [acme.id],
    job_ids: [],
    user_ids: [],
    date_from: '2026-09-01',
    date_to: '2026-09-30',
  },
  entries_examined: 1,
  entries_changed: 1,
  entries_skipped: 3,
  charge_value_before: 6000,
  charge_value_after: 14500,
  charge_value_delta: 8500,
  cost_value_before: 1000,
  cost_value_after: 1000,
  cost_value_delta: 0,
  requested_by: ada.id,
  requested_by_name: 'Ada Lovelace',
  note: 'September correction',
};
export const revalueRun: Rerun = {
  ...rerun,
  id: 'run-2',
  source: 'revalue',
  created_at: '2026-10-10T09:00:00Z',
  scope: { date_from: '2026-08-01', date_to: '2026-08-31' },
  entries_changed: 4,
  entries_skipped: 0,
  charge_value_before: 20000,
  charge_value_after: 19000,
  charge_value_delta: -1000,
  note: null,
};
export const testReruns: Rerun[] = [rerun, revalueRun];

export const rerunItem: RerunItem = {
  id: 'item-1',
  entry_id: 'entry-1',
  entry_date: '2026-09-07',
  minutes: 60,
  staff: samRef,
  client: ref(acme.id, acme.code, acme.name),
  job: ref('job-1', 'J00002', 'Year-end accounts'),
  outcome: 'changed',
  skip_reason: null,
  old: previewEntry.old,
  new: previewEntry.new,
};

export const job: JobOption = {
  id: 'job-1',
  number: 'J00002',
  name: 'Year-end accounts',
  client_id: acme.id,
  client_code: acme.code,
  client_name: acme.name,
  service_id: accounts.id,
  service_name: accounts.name,
};

/* ------------------------- Services and activity types ------------------------ */

export const standardVat: VatCode = {
  id: 'vat-standard',
  name: 'Standard 20%',
  code: 'standard',
  rate_bp: 2000,
  is_default: true,
  is_archived: false,
};
export const zeroVat: VatCode = {
  id: 'vat-zero',
  name: 'Zero rated',
  code: 'zero',
  rate_bp: 0,
  is_default: false,
  is_archived: false,
};
export const testVatCodes: VatCode[] = [standardVat, zeroVat];

export const activity = (
  id: string,
  code: string,
  name: string,
  overrides: Partial<ActivityType> = {},
): ActivityType => ({
  id,
  code,
  name,
  is_chargeable: true,
  vat_rate_id: null,
  invoice_description: null,
  is_active: true,
  status: 'active',
  is_used: false,
  can_delete: true,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

export const bookkeeping = activity('act-book', 'BOOK', 'Bookkeeping', {
  vat_rate_id: standardVat.id,
  invoice_description: 'Bookkeeping services',
  is_used: true,
  can_delete: false,
});
export const review = activity('act-review', 'REV', 'Review');
export const training = activity('act-train', 'TRN', 'Training', {
  is_chargeable: false,
  is_active: false,
  status: 'inactive',
});
export const testActivities: ActivityType[] = [bookkeeping, review, training];

export const service = (
  id: string,
  code: string,
  name: string,
  overrides: Partial<Service> = {},
): Service => ({
  id,
  code,
  name,
  description: null,
  billing_basis: 'hourly',
  default_fee: null,
  default_billable: true,
  vat_rate_id: null,
  invoice_description: null,
  is_active: true,
  status: 'active',
  sort_order: 0,
  activity_code_ids: [],
  task_template_count: 0,
  is_used: false,
  can_delete: true,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

export const template = (
  id: string,
  title: string,
  sortOrder: number,
  overrides: Partial<TaskTemplate> = {},
): TaskTemplate => ({
  id,
  title,
  description: null,
  budget_minutes: null,
  due_offset_days: null,
  sort_order: sortOrder,
  ...overrides,
});

/** The default tasks of the year-end accounts service. */
export const accountsTemplates: TaskTemplate[] = [
  template('tpl-1', 'Request records', 0, { due_offset_days: 7 }),
  template('tpl-2', 'Prepare the accounts', 1, {
    budget_minutes: 270,
    description: 'Trial balance to draft accounts',
  }),
  template('tpl-3', 'Partner review', 2, { due_offset_days: 30 }),
];

export const accountsService = service(accounts.id, 'ACCS', 'Year-end accounts', {
  billing_basis: 'fixed',
  default_fee: 45000,
  vat_rate_id: standardVat.id,
  invoice_description: 'Preparation of annual accounts',
  activity_code_ids: [bookkeeping.id, review.id],
  task_template_count: accountsTemplates.length,
  is_used: true,
  can_delete: false,
});
export const taxService = service('service-tax', 'TAX', 'Tax advice', {
  default_billable: false,
  description: 'Ad hoc tax questions',
});
export const archivedService = service('service-old', 'OLD', 'Legacy payroll', {
  is_active: false,
  status: 'inactive',
});
export const testServices: Service[] = [accountsService, taxService, archivedService];
