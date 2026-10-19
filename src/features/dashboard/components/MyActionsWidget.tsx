import { Link } from 'react-router';

import { buttonClasses } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import { useMyActions } from '../api';
import { OVERVIEW_LIST_SIZE } from '../constants';
import { pluralize, practicePath } from '../utils/format';
import { ActionList } from './ActionList';
import { Widget } from './Widget';

export interface MyActionsWidgetProps {
  limit?: number;
}

/** The first actions of the caller, most urgent first, and a link to all of them. */
export function MyActionsWidget({ limit = OVERVIEW_LIST_SIZE }: MyActionsWidgetProps) {
  const { organization } = useOrg();
  const query = useMyActions(limit);
  const all = practicePath(organization.slug, '/dashboard/my-actions');
  return (
    <Widget
      title="My Actions"
      query={query}
      isEmpty={(data) => data.total === 0}
      emptyTitle="You're all caught up"
      emptyDescription="Nothing needs your attention right now."
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
          <ActionList actions={data.actions} />
          {data.total > data.actions.length ? (
            <p className="text-xs text-text-muted">
              {pluralize(data.total - data.actions.length, 'more action')} on My Actions.
            </p>
          ) : null}
        </>
      )}
    </Widget>
  );
}
