import { History } from 'lucide-react';

import { EmptyState } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDateTime } from '@/utils/dates';

import type { ActivityEvent } from '../types';

export interface ActivityTimelineProps {
  events: ReadonlyArray<ActivityEvent>;
}

/** Who did it: a person, a person who has left, or the central service (no actor at all). */
const actorOf = (event: ActivityEvent) =>
  event.actor_name ?? (event.actor_user_id ? 'A former member' : 'Capium central');

/**
 * The last things that happened to the client (the audit entries the caller may see): what, who
 * and when. A central event has no person: it reads "Capium central".
 */
export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const { organization } = useOrg();
  return (
    <section
      aria-labelledby="client-activity"
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
    >
      <h2 id="client-activity" className="text-base font-semibold text-text">
        Recent activity
      </h2>
      {events.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" />}
          title="No recent activity"
          description="Changes to the client, its work and its money show up here."
          className="py-6"
        />
      ) : (
        <ol aria-label="Recent activity" className="flex flex-col">
          {events.map((event, index) => (
            <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < events.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-3 bottom-0 left-[5px] w-px bg-border"
                />
              ) : null}
              <span
                aria-hidden="true"
                className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-brand bg-surface"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-xs font-medium text-text">{event.label}</p>
                <p className="text-xs text-text-muted">
                  {actorOf(event)} ·{' '}
                  <time dateTime={event.at}>
                    {formatUkDateTime(event.at, organization.timezone)}
                  </time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
