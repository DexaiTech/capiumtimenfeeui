import { Link } from 'react-router';

import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  Table,
  Tabs,
  buttonClasses,
  useToast,
  type TableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { formatUkDateTime } from '@/utils/dates';

import { useApproveExpenseClaim, useApproveTimesheet, usePendingApprovals } from '../api';
import { Widget } from '../components/Widget';
import { APPROVAL_KIND_LABEL } from '../constants';
import { useKindParam } from '../hooks/useDashboardParams';
import type { ApprovalItem, ApprovalKind } from '../types';
import { describeFailure } from '../utils/errors';
import { approvalDetails, practicePath } from '../utils/format';

const PAGE_LIMIT = 50;
/** The kinds that can be approved from this page: the others are decided on their own screens. */
const DECIDED_HERE: ReadonlyArray<ApprovalKind> = ['timesheet', 'expense'];
const DECIDED_NOTICE: Record<ApprovalKind, string> = {
  timesheet: 'Timesheet approved',
  expense: 'Expense claim approved',
  invoice: 'Invoice approved',
  wip_adjustment: 'WIP adjustment approved',
};

type TabValue = ApprovalKind | 'all';

/**
 * `/:orgSlug/dashboard/pending-approvals`: timesheets and expense claims waiting for the
 * caller, one tab per kind. A timesheet or a claim is approved here with one click; returning
 * one (which needs a reason) and every other kind are decided on the module's own screen.
 */
export default function DashboardPendingApprovalsPage() {
  const { organization } = useOrg();
  const { toast } = useToast();
  useDocumentTitle('Pending Approvals');
  const [kind, setKind] = useKindParam();
  const query = usePendingApprovals(kind, PAGE_LIMIT);
  const approveSheet = useApproveTimesheet();
  const approveClaim = useApproveExpenseClaim();
  const working = approveSheet.isPending
    ? approveSheet.variables
    : approveClaim.isPending
      ? approveClaim.variables
      : null;

  const approve = (item: ApprovalItem) => {
    const mutation = item.kind === 'timesheet' ? approveSheet : approveClaim;
    mutation.mutate(item.id, {
      onSuccess: () =>
        toast({
          tone: 'success',
          title: DECIDED_NOTICE[item.kind],
          description: `${item.title}: ${approvalDetails(item)}`,
        }),
      onError: (error) => {
        const notice = describeFailure(error, 'Could not approve');
        toast({ tone: 'error', title: notice.title, description: notice.description });
      },
    });
  };

  const columns: ReadonlyArray<TableColumn<ApprovalItem>> = [
    {
      id: 'who',
      header: 'Waiting on you',
      card: 'title',
      cell: (item) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-text">{item.title}</span>
          <Badge size="sm" tone={item.kind === 'timesheet' ? 'violet' : 'blue'}>
            {item.kind === 'timesheet' ? 'Timesheet' : 'Expense claim'}
          </Badge>
        </span>
      ),
    },
    { id: 'details', header: 'Details', cell: (item) => approvalDetails(item) },
    {
      id: 'submitted',
      header: 'Submitted',
      cell: (item) => formatUkDateTime(item.submitted_at, organization.timezone),
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Pending Approvals"
        description="Timesheets and expense claims waiting for your approval, the oldest first."
        className="mb-1"
      />
      <Widget
        title="Waiting for you"
        query={query}
        isEmpty={(data) => data.total === 0}
        emptyTitle="Nothing is waiting for your approval"
        emptyDescription="Timesheets and expense claims you may decide on will appear here."
      >
        {(data) => {
          const active: TabValue = kind ?? 'all';
          return (
            <div className="flex flex-col gap-4">
              <Tabs<TabValue>
                label="Kinds of approval"
                idBase="approvals"
                value={active}
                onChange={(next) => setKind(next === 'all' ? null : next)}
                items={[
                  { value: 'all', label: `All (${String(data.total)})` },
                  ...data.kinds.map((summary) => ({
                    value: summary.kind,
                    label: `${APPROVAL_KIND_LABEL[summary.kind]} (${String(summary.count)})`,
                  })),
                ]}
              />
              <div
                role="tabpanel"
                id={`approvals-panel-${active}`}
                aria-labelledby={`approvals-tab-${active}`}
                className="flex flex-col gap-3"
              >
                {data.items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-muted">
                    Nothing is waiting in this list.
                  </p>
                ) : (
                  <Table
                    caption="Approvals waiting"
                    columns={columns}
                    rows={data.items}
                    rowKey={(item) => `${item.kind}:${item.id}`}
                    rowActions={(item) => {
                      const to = practicePath(organization.slug, item.link);
                      return (
                        <div className="flex items-center justify-end gap-2">
                          {DECIDED_HERE.includes(item.kind) ? (
                            <Button
                              size="sm"
                              variant="brand-outline"
                              loading={working === item.id}
                              disabled={working !== null}
                              aria-label={`Approve ${item.kind === 'timesheet' ? 'timesheet' : 'expense claim'} of ${item.title}`}
                              onClick={() => approve(item)}
                            >
                              Approve
                            </Button>
                          ) : null}
                          {to ? (
                            <Link
                              to={to}
                              aria-label={`Review ${item.kind === 'timesheet' ? 'timesheet' : 'expense claim'} of ${item.title}`}
                              className={buttonClasses({ variant: 'outline', size: 'sm' })}
                            >
                              Review
                            </Link>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                )}
                {data.items.some((item) => !DECIDED_HERE.includes(item.kind)) ? (
                  <p className="text-xs text-text-muted">
                    Other kinds are approved on their own screens: use Review.
                  </p>
                ) : null}
                {data.items.length >= PAGE_LIMIT ? (
                  <p className="text-xs text-text-muted">
                    Showing the oldest {String(PAGE_LIMIT)}: approve some to see the rest.
                  </p>
                ) : null}
              </div>
            </div>
          );
        }}
      </Widget>
    </section>
  );
}
