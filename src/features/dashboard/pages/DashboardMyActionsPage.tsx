import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';

import { useMyActions } from '../api';
import { ActionList } from '../components/ActionList';
import { Widget } from '../components/Widget';
import { PRIORITIES, PRIORITY_META } from '../constants';
import { pluralize } from '../utils/format';

const PAGE_LIMIT = 100;

/**
 * `/:orgSlug/dashboard/my-actions`: everything that needs the caller's attention, grouped by
 * priority and, inside a group, by kind: returned timesheets and claims, overdue jobs and tasks,
 * budgets, approvals waiting and draft invoices.
 */
export default function DashboardMyActionsPage() {
  useDocumentTitle('My Actions');
  const query = useMyActions(PAGE_LIMIT);
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="My Actions"
        description="What needs your attention, the most urgent first."
        className="mb-1"
      />
      <Widget
        title="Your actions"
        query={query}
        isEmpty={(data) => data.total === 0}
        emptyTitle="You're all caught up"
        emptyDescription="Timesheets to submit, approvals waiting, jobs due and budgets nearing their limit will appear here."
      >
        {(data) => (
          <div className="flex flex-col gap-5">
            <ul aria-label="Actions by priority" className="flex flex-wrap gap-2">
              {PRIORITIES.map((priority) => (
                <li key={priority}>
                  <Badge tone={data.counts[priority] > 0 ? PRIORITY_META[priority].tone : 'grey'}>
                    {PRIORITY_META[priority].label} {String(data.counts[priority])}
                  </Badge>
                </li>
              ))}
            </ul>
            {PRIORITIES.map((priority) => {
              const group = data.actions.filter((action) => action.priority === priority);
              if (group.length === 0) return null;
              return (
                <div key={priority} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-text">
                    {PRIORITY_META[priority].label} priority{' '}
                    <span className="font-normal text-text-muted">
                      ({pluralize(group.length, 'action')})
                    </span>
                  </h3>
                  <ActionList actions={group} hidePriority />
                </div>
              );
            })}
            {data.total > data.actions.length ? (
              <p className="text-xs text-text-muted">
                Showing the first {String(data.actions.length)} of {String(data.total)} actions.
              </p>
            ) : null}
          </div>
        )}
      </Widget>
    </section>
  );
}
