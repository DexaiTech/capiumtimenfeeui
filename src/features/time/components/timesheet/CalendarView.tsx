import { TriangleAlert } from 'lucide-react';

import { Card, Skeleton } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';
import { formatUkDate, todayInZone } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useCalendar } from '../../api';
import type { CalendarDay } from '../../types';
import {
  calendarWeeks,
  formatLongDay,
  isSameMonth,
  monthLabel,
  weekdayName,
} from '../../utils/weeks';
import { SheetStatusBadge } from '../badges';
import { LoadError } from '../PageShell';

export interface CalendarViewProps {
  /** Any day of the month to show. */
  date: string;
  onOpenDay: (date: string) => void;
}

/**
 * A month, one button per day with what was recorded against the target; a click opens the day.
 * The last column gives each week its total and the status of its timesheet.
 */
export function CalendarView({ date, onOpenDay }: CalendarViewProps) {
  const { organization } = useOrg();
  const weeks = calendarWeeks(date, organization.week_start);
  const from = weeks[0]?.[0] ?? date;
  const to = weeks[weeks.length - 1]?.[6] ?? date;
  const calendar = useCalendar('me', from, to);
  const today = todayInZone(organization.timezone);

  if (calendar.isError && !calendar.data) {
    return (
      <LoadError
        title="Could not load the calendar"
        error={calendar.error}
        onRetry={() => void calendar.refetch()}
        retrying={calendar.isRefetching}
      />
    );
  }

  const byDate = new Map<string, CalendarDay>(
    (calendar.data?.days ?? []).map((day) => [day.date, day]),
  );
  const headings = weeks[0] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">{monthLabel(date)}</h2>
        {calendar.data ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div>
              <dt className="text-text-muted">Logged in the weeks shown</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(calendar.data.total_minutes)}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Target</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(calendar.data.target_minutes)}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Billable</dt>
              <dd className="font-semibold text-text tabular-nums">
                {formatMinutes(calendar.data.billable_minutes)}
              </dd>
            </div>
          </dl>
        ) : (
          <Skeleton className="h-4 w-48" shape="rect" />
        )}
      </Card>

      <Card padding="none" className="overflow-x-auto">
        <table
          aria-label={`Time recorded in ${monthLabel(date)}`}
          aria-busy={calendar.isPending || undefined}
          className="w-full min-w-[44rem] table-fixed border-separate border-spacing-0 text-xs"
        >
          <thead>
            <tr>
              {headings.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="h-[37px] border-b border-row-border px-2 text-left font-medium text-text-muted"
                >
                  {weekdayName(day)}
                </th>
              ))}
              <th
                scope="col"
                className="h-[37px] w-36 border-b border-row-border px-2 text-right font-medium text-text-muted"
              >
                Week
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const days = week.map((day) => byDate.get(day));
              const total = days.reduce((sum, day) => sum + (day?.total_minutes ?? 0), 0);
              const status = days.find((day) => day !== undefined)?.timesheet_status;
              return (
                <tr key={week[0]}>
                  {week.map((day) => {
                    const info = byDate.get(day);
                    const logged = info?.total_minutes ?? 0;
                    const target = info?.target_minutes ?? 0;
                    const due = day <= today && info?.is_working_day === true && logged === 0;
                    const inMonth = isSameMonth(day, date);
                    return (
                      <td key={day} className="border-b border-row-border p-1 align-top">
                        <button
                          type="button"
                          onClick={() => onOpenDay(day)}
                          aria-label={`${formatLongDay(day)}: ${formatMinutes(logged)} logged${
                            target > 0 ? ` of ${formatMinutes(target)}` : ', day off'
                          }. Open the day.`}
                          className={cn(
                            'flex min-h-16 w-full flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left',
                            'transition-colors duration-fast ease-standard hover:bg-surface-hover',
                            day === today ? 'border-brand' : 'border-transparent',
                            !inMonth && 'opacity-60',
                            info && !info.is_working_day && 'bg-surface-sunken',
                          )}
                        >
                          <span className="text-2xs font-medium text-text-muted">
                            {Number(day.slice(8, 10))}
                            {day === today ? <span className="sr-only"> (today)</span> : null}
                          </span>
                          <span className="font-semibold text-text tabular-nums">
                            {logged > 0 ? formatMinutes(logged) : ''}
                          </span>
                          {target > 0 && logged > 0 ? (
                            <span className="text-2xs text-text-muted tabular-nums">
                              of {formatMinutes(target)}
                            </span>
                          ) : null}
                          {due ? (
                            <span className="flex items-center gap-0.5 text-2xs text-warning">
                              <TriangleAlert className="size-3" aria-hidden="true" />
                              No time
                            </span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-b border-row-border px-2 py-1 text-right align-top">
                    <p className="font-semibold text-text tabular-nums">{formatMinutes(total)}</p>
                    <p className="text-2xs text-text-muted">Week of {formatUkDate(week[0])}</p>
                    {status ? <SheetStatusBadge status={status} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
