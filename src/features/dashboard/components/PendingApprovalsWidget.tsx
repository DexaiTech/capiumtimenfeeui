import { Link } from 'react-router';

import { Badge, buttonClasses } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import { usePendingApprovals } from '../api';
import { APPROVAL_KIND_LABEL, OVERVIEW_LIST_SIZE } from '../constants';
import { approvalDetails, practicePath } from '../utils/format';
import { Widget } from './Widget';

export interface PendingApprovalsWidgetProps {
  limit?: number;
}

/** What waits for the caller's decision: the counts per kind and the oldest few. */
export function PendingApprovalsWidget({
  limit = OVERVIEW_LIST_SIZE,
}: PendingApprovalsWidgetProps) {
  const { organization } = useOrg();
  const query = usePendingApprovals(null, limit);
  const all = practicePath(organization.slug, '/dashboard/pending-approvals');
  return (
    <Widget
      title="Pending Approvals"
      query={query}
      isEmpty={(data) => data.total === 0}
      emptyTitle="Nothing is waiting for your approval"
      emptyDescription="Timesheets and expense claims you may decide on will appear here."
      actions={
        all ? (
          <Link to={all} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            View all
          </Link>
        ) : null
      }
    >
      {(data) => (
        <>
          <ul aria-label="Waiting by kind" className="flex flex-wrap gap-2">
            {data.kinds.map((summary) => (
              <li key={summary.kind}>
                <Badge tone={summary.count > 0 ? 'blue' : 'grey'}>
                  {APPROVAL_KIND_LABEL[summary.kind]} {String(summary.count)}
                </Badge>
              </li>
            ))}
          </ul>
          <ul aria-label="Oldest waiting" className="flex flex-col divide-y divide-border">
            {data.items.map((item) => {
              const to = practicePath(organization.slug, item.link);
              return (
                <li
                  key={`${item.kind}:${item.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-text">{item.title}</span>
                    <span className="truncate text-xs text-text-muted">
                      {approvalDetails(item)}
                    </span>
                  </div>
                  {to ? (
                    <Link
                      to={to}
                      aria-label={`Review ${APPROVAL_KIND_LABEL[item.kind].toLowerCase()} of ${item.title}`}
                      className={buttonClasses({ variant: 'outline', size: 'sm' })}
                    >
                      Review
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Widget>
  );
}
