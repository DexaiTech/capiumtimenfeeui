import { PERMISSIONS, type PermissionCode } from './permissions';

/** The reports of `docs/domain.md` ("Reports"). `key` is the `:reportKey` of the route. */
export interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  /** `report.read` for time, jobs and utilisation; `report.financial` for money. */
  permission: PermissionCode;
}

export const REPORTS: ReadonlyArray<ReportDefinition> = [
  {
    key: 'wip',
    label: 'WIP',
    description: 'Unbilled WIP per client and job: hours, time value, disbursements and age.',
    permission: PERMISSIONS.reportFinancial,
  },
  {
    key: 'aged-debtors',
    label: 'Aged debtors',
    description: 'Outstanding balance per client by days past the due date.',
    permission: PERMISSIONS.reportFinancial,
  },
  {
    key: 'time-summary',
    label: 'Time summary',
    description: 'Minutes per person, client, job and activity, chargeable and not.',
    permission: PERMISSIONS.reportRead,
  },
  {
    key: 'utilisation',
    label: 'Utilisation',
    description: 'Chargeable time against capacity and target, per person.',
    permission: PERMISSIONS.reportRead,
  },
  {
    key: 'recoverability',
    label: 'Recoverability',
    description: 'WIP value billed, write-ups and write-offs per client, job and person.',
    permission: PERMISSIONS.reportFinancial,
  },
  {
    key: 'billing-summary',
    label: 'Billing summary',
    description: 'Invoices, credit notes and receipts per month and per partner.',
    permission: PERMISSIONS.reportFinancial,
  },
  {
    key: 'job-profitability',
    label: 'Job profitability',
    description: 'Billed value against the cost of time, with budget against actual.',
    permission: PERMISSIONS.reportFinancial,
  },
  {
    key: 'vat-summary',
    label: 'VAT summary',
    description: 'Output VAT by rate on invoices issued, less credit notes.',
    permission: PERMISSIONS.reportFinancial,
  },
];

export function findReport(key: string | undefined): ReportDefinition | undefined {
  return REPORTS.find((report) => report.key === key);
}
