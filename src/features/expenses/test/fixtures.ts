import { testOrganization } from '@/test/orgFixtures';
import { testUser } from '@/test/fixtures';

import type {
  ClaimActions,
  ClaimEvent,
  ClaimStatus,
  Disbursement,
  ExpenseClaimDetail,
  ExpenseLine,
  ExpenseType,
  Receipt,
} from '../types';

/** The practice of the tests, with the expense settings the API sends with every practice. */
export const expensePractice = {
  ...testOrganization,
  receipt_required_threshold: 2500,
  mileage_rate: 45,
  expense_markup_bp: 1000,
};

export const ada = { id: testUser.id, name: testUser.full_name };
export const ben = { id: '0198c1f2-0000-7000-8000-000000000002', name: 'Ben Carter' };

/** The ids the fixtures share; the VAT codes and the types are the practice's. */
export const IDS = {
  standardVat: '0198c1f2-0000-7000-8000-0000000000c1',
  zeroVat: '0198c1f2-0000-7000-8000-0000000000c2',
  travel: '0198c1f2-0000-7000-8000-0000000000d1',
  mileage: '0198c1f2-0000-7000-8000-0000000000d2',
  subsistence: '0198c1f2-0000-7000-8000-0000000000d3',
  retired: '0198c1f2-0000-7000-8000-0000000000d4',
  acme: '0198c1f2-0000-7000-8000-0000000000e1',
  globex: '0198c1f2-0000-7000-8000-0000000000e2',
  job: '0198c1f2-0000-7000-8000-0000000000f1',
} as const;

export const vatCodes = [
  {
    id: IDS.standardVat,
    name: 'Standard rate',
    code: 'S',
    rate_bp: 2000,
    is_default: true,
    is_archived: false,
  },
  {
    id: IDS.zeroVat,
    name: 'Zero rate',
    code: 'Z',
    rate_bp: 0,
    is_default: false,
    is_archived: false,
  },
];

export const clients = [
  { id: IDS.acme, code: 'ACME', name: 'Acme Ltd' },
  { id: IDS.globex, code: 'GLOBEX', name: 'Globex Ltd' },
];

export const jobs = [
  {
    id: IDS.job,
    number: 'TJ00002',
    name: 'Year-end accounts',
    client_id: IDS.acme,
    client_code: 'ACME',
    client_name: 'Acme Ltd',
    service_id: null,
    service_name: null,
    billing_basis: 'hourly',
  },
];

const STAMP = '2026-10-10T09:00:00Z';

export function expenseType(overrides: Partial<ExpenseType> = {}): ExpenseType {
  return {
    id: IDS.travel,
    name: 'Travel',
    code: 'TRAVEL',
    default_vat_rate_id: IDS.zeroVat,
    is_mileage: false,
    default_billable: true,
    is_active: true,
    is_used: true,
    can_delete: false,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export const types: ExpenseType[] = [
  expenseType(),
  expenseType({
    id: IDS.mileage,
    name: 'Mileage',
    code: 'MILEAGE',
    default_vat_rate_id: null,
    is_mileage: true,
  }),
  expenseType({
    id: IDS.subsistence,
    name: 'Subsistence',
    code: 'SUBSISTENCE',
    default_vat_rate_id: IDS.standardVat,
    default_billable: false,
    is_used: false,
    can_delete: true,
  }),
  expenseType({
    id: IDS.retired,
    name: 'Old postage',
    code: 'OLDPOST',
    default_vat_rate_id: null,
    is_active: false,
    is_used: false,
    can_delete: true,
  }),
];

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};
const uuid = (prefix: string) => `0198c1f2-${prefix}-7000-8000-${String(next()).padStart(12, '0')}`;

export function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: uuid('0a01'),
    expense_id: 'line',
    file_name: 'train-ticket.png',
    content_type: 'image/png',
    size_bytes: 69,
    is_image: true,
    uploaded_by: ada.id,
    uploaded_by_name: ada.name,
    created_at: '2026-10-10T10:00:00Z',
    ...overrides,
  };
}

export function line(overrides: Partial<ExpenseLine> = {}): ExpenseLine {
  const id = overrides.id ?? uuid('0b01');
  const base: ExpenseLine = {
    id,
    claim_id: 'claim',
    expense_type_id: IDS.travel,
    expense_type: { id: IDS.travel, name: 'Travel', code: 'TRAVEL', is_mileage: false },
    incurred_on: '2026-09-07',
    description: 'Train to Leeds',
    client_id: IDS.acme,
    client: clients[0] ?? null,
    job_id: null,
    job: null,
    supplier: 'LNER',
    vat_rate_id: IDS.zeroVat,
    vat_rate_bp: 0,
    net: 4300,
    vat: 0,
    gross: 4300,
    miles: null,
    mileage_rate_applied: null,
    is_billable: true,
    markup_bp: 1000,
    recharge_amount: 4730,
    payer: 'staff',
    billing_status: 'unbilled',
    receipt_required: true,
    receipt_count: 0,
    receipts: [],
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
  return {
    ...base,
    receipt_count: overrides.receipt_count ?? base.receipts.length,
    receipts: base.receipts.map((entry) => ({ ...entry, expense_id: id })),
  };
}

/** What the caller may do with a claim of a status, as the API reports it. */
export function actionsFor(
  status: ClaimStatus,
  caller: { canDecide?: boolean; canManage?: boolean } = {},
): ClaimActions {
  const open = status === 'draft' || status === 'returned';
  const decide = status === 'submitted' && (caller.canDecide ?? false);
  return {
    can_edit: open,
    can_delete: status === 'draft',
    can_submit: open,
    can_recall: status === 'submitted',
    can_approve: decide,
    can_return: decide,
    can_correct: status === 'approved' && (caller.canManage ?? false),
  };
}

export function event(overrides: Partial<ClaimEvent> = {}): ClaimEvent {
  return {
    id: uuid('0c01'),
    action: 'submitted',
    actor_user_id: ada.id,
    actor_name: ada.name,
    note: null,
    created_at: '2026-10-11T09:30:00Z',
    ...overrides,
  };
}

/** A claim with its lines: the totals, the count and the period follow the lines. */
export function claim(
  overrides: Partial<Omit<ExpenseClaimDetail, 'lines'>> & { lines?: ExpenseLine[] } = {},
): ExpenseClaimDetail {
  const id = overrides.id ?? uuid('0d01');
  const status = overrides.status ?? 'draft';
  const lines = (overrides.lines ?? []).map((entry) => ({ ...entry, claim_id: id }));
  const dates = lines.map((entry) => entry.incurred_on).sort();
  const sum = (pick: (entry: ExpenseLine) => number) =>
    lines.reduce((total, entry) => total + pick(entry), 0);
  return {
    id,
    user_id: ada.id,
    user_name: ada.name,
    created_by: ada.id,
    created_by_name: ada.name,
    title: 'Client visit, Leeds',
    status,
    submitted_at: status === 'draft' ? null : '2026-10-11T09:30:00Z',
    decided_at: null,
    decided_by: null,
    decided_by_name: null,
    decision_note: null,
    line_count: lines.length,
    first_date: dates[0] ?? null,
    last_date: dates[dates.length - 1] ?? null,
    totals: {
      net: sum((entry) => entry.net),
      vat: sum((entry) => entry.vat),
      gross: sum((entry) => entry.gross),
      recharge: sum((entry) => entry.recharge_amount),
      reimbursable: sum((entry) => (entry.payer === 'staff' ? entry.gross : 0)),
    },
    actions: actionsFor(status),
    created_at: STAMP,
    updated_at: STAMP,
    events: [],
    ...overrides,
    lines,
  };
}

export function disbursement(overrides: Partial<Disbursement> = {}): Disbursement {
  return {
    id: uuid('0e01'),
    client_id: IDS.acme,
    job_id: null,
    incurred_on: '2026-09-12',
    description: 'Companies House fee',
    supplier: 'Companies House',
    amount: 1300,
    vat_rate_id: null,
    is_billable: true,
    billing_status: 'unbilled',
    created_by: ada.id,
    created_at: STAMP,
    ...overrides,
  };
}
