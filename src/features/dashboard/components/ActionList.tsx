import { Link } from 'react-router';

import { Badge, buttonClasses } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';

import { ACTION_ICON, PRIORITY_META } from '../constants';
import type { MyAction } from '../types';
import { actionDetails, practicePath } from '../utils/format';

export interface ActionListProps {
  actions: ReadonlyArray<MyAction>;
  /** Hides the priority pill (the page groups by priority already). */
  hidePriority?: boolean;
  className?: string;
}

/** Actions, one row each: what to do, what it is about, how late, and a link to do it. */
export function ActionList({ actions, hidePriority = false, className }: ActionListProps) {
  const { organization } = useOrg();
  return (
    <ul aria-label="Actions" className={cn('flex flex-col divide-y divide-border', className)}>
      {actions.map((action) => {
        const Icon = ACTION_ICON[action.kind];
        const priority = PRIORITY_META[action.priority];
        const to = practicePath(organization.slug, action.link);
        const details = actionDetails(action);
        return (
          <li key={action.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-badge-grey-soft text-badge-grey"
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                {action.title}
                {action.count > 1 ? (
                  <Badge size="sm" tone="grey">
                    {String(action.count)}
                  </Badge>
                ) : null}
                {hidePriority ? null : (
                  <Badge size="sm" tone={priority.tone}>
                    {priority.label}
                  </Badge>
                )}
              </p>
              {action.subject ? (
                <p className="text-sm text-text">
                  {action.subject}
                  {action.context ? (
                    <span className="text-text-muted"> {action.context}</span>
                  ) : null}
                </p>
              ) : null}
              {details.length > 0 ? (
                <p className="text-xs text-text-muted">{details.join(' - ')}</p>
              ) : null}
            </div>
            {to ? (
              <Link
                to={to}
                aria-label={`Open: ${action.title}${action.subject ? ` ${action.subject}` : ''}`}
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                Open
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
