import { Link } from 'react-router';

import type { DataTableColumn, DataTableSort } from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import type { ClaimSort, ExpenseClaim, SortOrder } from '../types';
import { claimLabel, dateSpan } from '../utils/format';
import { ClaimStatusBadge } from './StatusBadge';

/** The column that sorts by each key the API takes (`GET /expense-claims`, `sort`). */
const COLUMN_OF_SORT: Record<ClaimSort, string> = {
  created_at: 'created',
  submitted_at: 'submitted',
  total: 'gross',
  user: 'claimant',
};

const SORT_OF_COLUMN: Record<string, ClaimSort> = {
  created: 'created_at',
  submitted: 'submitted_at',
  gross: 'total',
  claimant: 'user',
};

export const CLAIM_SORTS: ReadonlyArray<ClaimSort> = [
  'created_at',
  'submitted_at',
  'total',
  'user',
];

/** The API sorts newest and largest first, the claimant's name from A. */
export const defaultOrder = (sort: ClaimSort): SortOrder => (sort === 'user' ? 'asc' : 'desc');

/** The table's sort state for the API's `sort` and `order`. */
export function tableSort(sort: ClaimSort, order: SortOrder): DataTableSort {
  return { columnId: COLUMN_OF_SORT[sort], direction: order };
}

/** The API's sort for a column the person clicked; null for a column that does not sort. */
export function sortOfColumn(columnId: string): ClaimSort | null {
  return SORT_OF_COLUMN[columnId] ?? null;
}

export interface ClaimColumnsOptions {
  slug: string;
  /** Which list the links open the claim from ('mine' or the claims list). */
  list: 'mine' | 'claims' | 'approvals';
  showClaimant: boolean;
  currency: string;
}

/** The columns of a list of claims: shared by My Expenses and Expense Claims. */
export function claimColumns({
  slug,
  list,
  showClaimant,
  currency,
}: ClaimColumnsOptions): DataTableColumn<ExpenseClaim>[] {
  const columns: DataTableColumn<ExpenseClaim>[] = [
    {
      id: 'claim',
      header: 'Claim',
      hideable: false,
      className: 'min-w-56 max-w-80',
      cell: (claim) => (
        <Link
          to={routes.org.expenseClaim(slug, claim.id, list)}
          className="block min-w-0 truncate font-semibold text-text hover:text-brand-text hover:underline"
          title={claimLabel(claim)}
        >
          {claimLabel(claim)}
        </Link>
      ),
    },
  ];
  if (showClaimant) {
    columns.push({
      id: 'claimant',
      header: 'Claimant',
      sortable: true,
      className: 'min-w-40',
      cell: (claim) => <span className="text-text">{claim.user_name ?? '—'}</span>,
    });
  }
  columns.push(
    {
      id: 'period',
      header: 'Period',
      className: 'min-w-44 whitespace-nowrap',
      cell: (claim) =>
        claim.line_count > 0 ? (
          <span className="text-text">{dateSpan(claim.first_date, claim.last_date)}</span>
        ) : (
          <span className="text-text-muted">No expenses</span>
        ),
    },
    {
      id: 'lines',
      header: 'Expenses',
      align: 'end',
      className: 'w-24',
      cell: (claim) => <span className="tabular-nums">{claim.line_count}</span>,
    },
    {
      id: 'created',
      header: 'Created',
      sortable: true,
      className: 'w-28 whitespace-nowrap',
      cell: (claim) => <span className="text-text">{formatUkDate(claim.created_at)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-32',
      cell: (claim) => <ClaimStatusBadge status={claim.status} />,
    },
    {
      id: 'submitted',
      header: 'Submitted',
      sortable: true,
      className: 'w-32 whitespace-nowrap',
      cell: (claim) =>
        claim.submitted_at ? (
          <span className="text-text">{formatUkDate(claim.submitted_at)}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'gross',
      header: 'Total',
      sortable: true,
      align: 'end',
      className: 'w-32 whitespace-nowrap',
      cell: (claim) => (
        <span className="font-semibold tabular-nums">
          {formatMoney(claim.totals.gross, currency)}
        </span>
      ),
    },
    {
      id: 'recharge',
      header: 'Recharged',
      align: 'end',
      className: 'w-32 whitespace-nowrap',
      cell: (claim) => (
        <span className="text-text-muted tabular-nums">
          {formatMoney(claim.totals.recharge, currency)}
        </span>
      ),
    },
  );
  return columns;
}
