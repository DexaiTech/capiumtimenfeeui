import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { Button, Card, CardHeader, EmptyState, Select, Skeleton } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatUkDate, todayInZone } from '@/utils/dates';

import { useJobCalendar } from '../api';
import { LoadError, PageShell } from '../components/PageShell';
import { JobStatusBadge } from '../components/StatusBadges';
import type { CalendarEvent, JobStatus } from '../types';
import { daysOfMonth, monthLabel, monthRange, shiftMonth, weekColumn } from '../utils/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const SCOPE_OPTIONS = [
  { value: '', label: 'Everyone’s work' },
  { value: 'me', label: 'My work' },
];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function EventChip({ event, slug }: { event: CalendarEvent; slug: string }) {
  const isTask = event.type === 'task';
  return (
    <Link
      to={routes.org.job(slug, event.job_id)}
      title={`${event.job_number} ${event.title}${isTask ? ' (task)' : ''}`}
      className={cn(
        'block truncate rounded-sm px-1.5 py-0.5 text-2xs hover:underline',
        isTask ? 'bg-badge-blue-soft text-badge-blue' : 'bg-badge-violet-soft text-badge-violet',
      )}
    >
      {isTask ? 'Task: ' : 'Job: '}
      {event.title}
    </Link>
  );
}

/** `/:orgSlug/jobs/calendar`: the jobs running in a month and the tasks due in it. */
export default function JobCalendarPage() {
  useDocumentTitle('Job Calendar');
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();

  const today = todayInZone(organization.timezone);
  const monthParam = params.get('month');
  const month = monthParam && MONTH.test(monthParam) ? monthParam : today.slice(0, 7);
  const scope = params.get('scope') === 'me' ? 'me' : '';
  const { from, to } = monthRange(`${month}-01`);

  const query = useJobCalendar({ from, to, assignee_user_id: scope || undefined });
  const events = query.data?.events ?? [];
  const jobs = events.filter((event) => event.type === 'job');
  const days = daysOfMonth(month);
  const lead = days[0] ? weekColumn(days[0], organization.week_start) : 0;
  const header = [
    ...WEEKDAYS.slice(organization.week_start - 1),
    ...WEEKDAYS.slice(0, organization.week_start - 1),
  ];

  /** Tasks due on a day, and the jobs that start or fall due on it. */
  const eventsOn = (day: string) =>
    events.filter((event) =>
      event.type === 'task' ? event.due === day : event.start === day || event.due === day,
    );

  const goTo = (next: string) => setParam({ month: next === today.slice(0, 7) ? null : next });

  return (
    <PageShell
      title="Job Calendar"
      description="The jobs running each month and the tasks that fall due in it."
      actions={
        <Select
          label="Show"
          hideLabel
          options={SCOPE_OPTIONS}
          value={scope}
          onChange={(event) => setParam({ scope: event.target.value || null })}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          aria-label="Previous month"
          leftIcon={<ChevronLeft aria-hidden="true" className="size-4" />}
          onClick={() => goTo(shiftMonth(month, -1))}
        >
          Previous
        </Button>
        <h2 className="min-w-36 text-center text-sm font-semibold text-text" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <Button size="sm" aria-label="Next month" onClick={() => goTo(shiftMonth(month, 1))}>
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => goTo(today.slice(0, 7))}>
          This month
        </Button>
      </div>

      {query.isError && !query.data ? (
        <LoadError
          title="Could not load the calendar"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : query.isPending ? (
        <Card>
          <Skeleton lines={5} />
        </Card>
      ) : (
        <>
          {jobs.length > 0 ? (
            <Card padding="none">
              <CardHeader
                title="Jobs in this month"
                description="From the start date to the due date."
              />
              <ul
                aria-label="Jobs in this month"
                className="flex flex-col divide-y divide-row-border"
              >
                {jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5"
                  >
                    <Link
                      to={routes.org.job(organization.slug, job.job_id)}
                      className="min-w-0 flex-1 truncate text-sm font-semibold text-text hover:text-brand-text"
                    >
                      {job.job_number} {job.title}
                    </Link>
                    <span className="text-xs text-text-muted">{job.client_name}</span>
                    <span className="text-xs text-text tabular-nums">
                      {formatUkDate(job.start)}
                      {job.end ? ` - ${formatUkDate(job.end)}` : ' onwards'}
                    </span>
                    <JobStatusBadge status={job.status as JobStatus} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {events.length === 0 ? (
            <Card padding="none">
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title={`Nothing is planned for ${monthLabel(month)}`}
                description="Jobs with a start or due date, and tasks with a due date, appear here."
              />
            </Card>
          ) : (
            <Card padding="none" className="overflow-hidden">
              <ol
                aria-label={`Calendar of ${monthLabel(month)}`}
                className="grid grid-cols-1 gap-px bg-border md:grid-cols-7"
              >
                {header.map((name) => (
                  <li
                    key={name}
                    aria-hidden="true"
                    className="hidden bg-surface-sunken px-2 py-1.5 text-center text-2xs font-semibold text-text-muted uppercase md:block"
                  >
                    {name}
                  </li>
                ))}
                {Array.from({ length: lead }, (_, index) => (
                  <li
                    key={`blank-${String(index)}`}
                    aria-hidden="true"
                    className="hidden bg-surface-sunken md:block"
                  />
                ))}
                {days.map((day) => {
                  const dayEvents = eventsOn(day);
                  return (
                    <li
                      key={day}
                      aria-label={formatUkDate(day)}
                      className={cn(
                        'flex min-h-24 flex-col gap-1 bg-surface p-2',
                        dayEvents.length === 0 && 'max-md:hidden',
                        day === today && 'bg-badge-violet-soft/40',
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-medium text-text-muted',
                          day === today && 'font-semibold text-brand-text',
                        )}
                      >
                        <span className="md:hidden">{formatUkDate(day)}</span>
                        <span className="max-md:hidden">{Number(day.slice(8))}</span>
                      </span>
                      {dayEvents.map((event) => (
                        <EventChip
                          key={`${event.type}-${event.id}-${day}`}
                          event={event}
                          slug={organization.slug}
                        />
                      ))}
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
          {events.length > 0 ? (
            <p className="text-xs text-text-muted">
              Tasks are drawn on their due date, jobs on the days they start and fall due.
            </p>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
