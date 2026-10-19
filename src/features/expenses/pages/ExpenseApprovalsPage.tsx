import { BadgeCheck, CircleCheck, ExternalLink, Redo2, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Button,
  Checkbox,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Table,
  type TableColumn,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { StaffPicker } from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { flattenPages, useApprovalQueue } from '../api';
import { ApproveDialog, BulkApproveDialog, ReturnDialog } from '../components/DecisionDialogs';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ReceiptPreview } from '../components/receipts/ReceiptPreview';
import { ReviewLines } from '../components/ReviewLines';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { ExpenseClaim, ExpenseLine, Receipt } from '../types';
import { claimLabel, dateSpan, pluralize } from '../utils/format';

type DialogState =
  | { type: 'approve'; claim: ExpenseClaim }
  | { type: 'return'; claim: ExpenseClaim }
  | { type: 'bulk' }
  | null;

interface Previewing {
  lineId: string;
  receipt: Receipt;
}

/**
 * `/:orgSlug/expenses/approvals`: the claims waiting for the caller's decision, oldest first.
 * A row opens to its expenses and receipts; a claim is approved or returned (with a reason)
 * from the row, and several are approved at once from the selection. A claim of one's own is
 * never offered unless the role may decide on it.
 */
export default function ExpenseApprovalsPage() {
  useDocumentTitle('Expense Approvals');
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const canApprove = can(PERMISSIONS.expenseApprove);
  const userId = params.get('user_id');
  const currency = organization.currency;

  const queue = useApprovalQueue(
    { user_id: userId ?? undefined, q: searched || undefined },
    { enabled: canApprove },
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [previewing, setPreviewing] = useState<Previewing | null>(null);
  const close = () => setDialog(null);

  const rows = flattenPages(queue.data);
  const chosen = rows.filter((claim) => selected.has(claim.id) && claim.actions.can_approve);
  const allSelected = rows.length > 0 && rows.every((claim) => selected.has(claim.id));
  const filtered = searched !== '' || userId !== null;

  const toggle = (claim: ExpenseClaim, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(claim.id);
      else next.delete(claim.id);
      return next;
    });

  const columns: TableColumn<ExpenseClaim>[] = [
    {
      id: 'select',
      header: 'Select',
      className: 'w-16',
      cell: (claim) => (
        <input
          type="checkbox"
          aria-label={`Select ${claimLabel(claim)}`}
          checked={selected.has(claim.id)}
          disabled={!claim.actions.can_approve}
          onChange={(event) => toggle(claim, event.target.checked)}
          className="size-4 cursor-pointer rounded-sm accent-primary align-middle disabled:cursor-not-allowed"
        />
      ),
    },
    {
      id: 'claim',
      header: 'Claim',
      card: 'title',
      className: 'min-w-56',
      cell: (claim) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{claim.user_name ?? 'Unknown'}</span>
          <Link
            to={routes.org.expenseClaim(organization.slug, claim.id, 'approvals')}
            className="inline-flex max-w-full items-center gap-1 truncate text-xs text-text-muted hover:text-brand-text hover:underline"
          >
            {claim.title ?? dateSpan(claim.first_date, claim.last_date)}
            <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
          </Link>
        </div>
      ),
    },
    {
      id: 'period',
      header: 'Period',
      className: 'whitespace-nowrap',
      cell: (claim) => dateSpan(claim.first_date, claim.last_date),
    },
    {
      id: 'submitted',
      header: 'Submitted',
      className: 'whitespace-nowrap',
      cell: (claim) => (claim.submitted_at ? formatUkDate(claim.submitted_at) : '—'),
    },
    {
      id: 'lines',
      header: 'Expenses',
      align: 'end',
      cell: (claim) => <span className="tabular-nums">{claim.line_count}</span>,
    },
    {
      id: 'total',
      header: 'Total',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (claim) => (
        <span className="font-semibold tabular-nums">
          {formatMoney(claim.totals.gross, currency)}
        </span>
      ),
    },
  ];

  if (!canApprove) return <NoAccess what="approving expense claims" />;

  const target = dialog && 'claim' in dialog ? dialog.claim : null;

  return (
    <PageShell
      title="Expense Approvals"
      description="Claims waiting for your decision, oldest first. Open a row to see the expenses and receipts, then approve the claim or return it with a reason."
    >
      {queue.isError && !queue.data ? (
        <LoadError
          title="Could not load the approval queue"
          error={queue.error}
          onRetry={() => void queue.refetch()}
          retrying={queue.isRefetching}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          <PageToolbar
            start={
              <p aria-live="polite" className="px-2 text-xs font-medium text-text">
                {queue.isPending ? 'Loading…' : `${pluralize(rows.length, 'claim')} waiting`}
              </p>
            }
            search={
              <SearchField
                label="Search the queue"
                placeholder="Quick search"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              <>
                <Checkbox
                  label="Select all"
                  checked={allSelected}
                  disabled={rows.length === 0}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? new Set(rows.map((claim) => claim.id)) : new Set(),
                    )
                  }
                />
                <FilterPopover
                  title="Filter the queue"
                  count={Number(userId !== null)}
                  onClear={() => setParam({ user_id: null })}
                >
                  <StaffPicker
                    label="Claimant"
                    clearable
                    includeLeft
                    value={userId}
                    onChange={(id) => setParam({ user_id: id })}
                  />
                </FilterPopover>
              </>
            }
            primaryAction={
              <Button
                variant="primary"
                size="sm"
                disabled={chosen.length === 0}
                onClick={() => setDialog({ type: 'bulk' })}
                leftIcon={<BadgeCheck aria-hidden="true" className="size-4" />}
              >
                Approve selected ({chosen.length})
              </Button>
            }
          />
          <Table
            caption="Claims waiting for approval"
            columns={columns}
            rows={rows}
            rowKey={(claim) => claim.id}
            loading={queue.isPending}
            expansion={{
              label: (claim) => `Expenses and receipts of ${claimLabel(claim)}`,
              render: (claim) => (
                <ReviewLines
                  claimId={claim.id}
                  currency={currency}
                  onPreview={(line: ExpenseLine, receipt) =>
                    setPreviewing({ lineId: line.id, receipt })
                  }
                />
              ),
            }}
            rowActions={(claim) => (
              <span className="inline-flex items-center gap-1.5">
                {claim.actions.can_return ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Return ${claimLabel(claim)}`}
                    onClick={() => setDialog({ type: 'return', claim })}
                    leftIcon={<Redo2 aria-hidden="true" className="size-4" />}
                  >
                    Return
                  </Button>
                ) : null}
                {claim.actions.can_approve ? (
                  <Button
                    size="sm"
                    variant="brand-outline"
                    aria-label={`Approve ${claimLabel(claim)}`}
                    onClick={() => setDialog({ type: 'approve', claim })}
                    leftIcon={<CircleCheck aria-hidden="true" className="size-4" />}
                  >
                    Approve
                  </Button>
                ) : null}
              </span>
            )}
            empty={
              filtered ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No claims match"
                  description="Try another search or claimant."
                  action={
                    <Button
                      onClick={() => {
                        setSearchText('');
                        setParam({ q: null, user_id: null });
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<BadgeCheck className="size-6" />}
                  title="Nothing is waiting for you"
                  description="Claims the people you manage submit show up here."
                />
              )
            }
          />
          {rows.length > 0 ? (
            <Pagination
              hasMore={queue.hasNextPage}
              onLoadMore={() => void queue.fetchNextPage()}
              loading={queue.isFetchingNextPage}
              count={rows.length}
              itemLabel={['claim', 'claims']}
            />
          ) : null}
        </div>
      )}

      {target && dialog?.type === 'approve' ? (
        <ApproveDialog
          claim={target}
          open
          onClose={close}
          onDone={() =>
            setSelected((current) => new Set([...current].filter((id) => id !== target.id)))
          }
        />
      ) : null}
      {target && dialog?.type === 'return' ? (
        <ReturnDialog claim={target} open onClose={close} />
      ) : null}
      <BulkApproveDialog
        claims={chosen}
        open={dialog?.type === 'bulk'}
        onClose={close}
        onDone={() => {
          setSelected(new Set());
          close();
        }}
      />
      {previewing ? (
        <ReceiptPreview
          lineId={previewing.lineId}
          receipt={previewing.receipt}
          open
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </PageShell>
  );
}
