import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Card,
  DataTable,
  Sheet,
  Skeleton,
  Badge,
  type DataTableColumn,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { addDays, formatUkDate, todayInZone } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useTimesheet, useWeek } from '../../api';
import type { StaffPerson, TimeEntry } from '../../types';
import { describeVariance, formatDayList, refLabel } from '../../utils/format';
import { buildRows, entriesByCell, servicesByJob } from '../../utils/grid';
import type { TeamRow } from '../../utils/team';
import { formatWeekRange } from '../../utils/weeks';
import { BillableBadge, SheetStatusBadge } from '../badges';
import { EntryDialog } from '../EntryDialog';
import { LoadError } from '../PageShell';
import { WeekGridTable } from '../timesheet/WeekGridTable';

export interface PersonSheetDrawerProps {
  /** The person whose week is shown; null closes the drawer. */
  person: TeamRow | null;
  /** Any day of the week. */
  weekStart: string;
  staff: ReadonlyArray<StaffPerson> | undefined;
  onClose: () => void;
}

function Content({
  person,
  weekStart,
  staff,
  onClose,
}: Omit<PersonSheetDrawerProps, 'person'> & { person: TeamRow }) {
  const { organization, can } = useOrg();
  const week = useWeek(person.userId, weekStart);
  const sheet = useTimesheet(week.data?.timesheet_id);
  const [recording, setRecording] = useState(false);

  const names = new Map((staff ?? []).map((member) => [member.id, member.full_name]));
  const entries = [...(sheet.data?.entries ?? [])].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at),
  );
  const grid = week.data;
  const variance = describeVariance(
    (grid?.total_minutes ?? 0) - (grid?.targets?.weekly_minutes ?? 0),
  );

  const columns: DataTableColumn<TimeEntry>[] = [
    {
      id: 'date',
      header: 'Date',
      className: 'whitespace-nowrap',
      cell: (entry) => formatUkDate(entry.entry_date),
    },
    {
      id: 'what',
      header: 'Client and job',
      cell: (entry) => (
        <div className="flex flex-col">
          <span className="font-semibold text-text uppercase">
            {entry.client_name ?? 'No client'}
          </span>
          <span className="text-text-muted">
            {refLabel({ code: entry.job_number, name: entry.job_name }) || 'No job'}
          </span>
        </div>
      ),
    },
    { id: 'activity', header: 'Activity', cell: (entry) => entry.activity_name ?? '—' },
    {
      id: 'description',
      header: 'Description',
      cell: (entry) => (
        <span className="block max-w-56 truncate" title={entry.description ?? undefined}>
          {entry.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (entry) => <span className="font-semibold">{formatMinutes(entry.minutes)}</span>,
    },
    {
      id: 'billable',
      header: 'Billable',
      cell: (entry) => <BillableBadge billable={entry.is_billable} />,
    },
    {
      id: 'enteredBy',
      header: 'Entered by',
      cell: (entry) => {
        if (entry.created_by === null || entry.created_by === entry.user_id) return 'Themselves';
        return (
          <span className="flex flex-col items-start gap-0.5">
            <span>{names.get(entry.created_by) ?? 'Another person'}</span>
            <Badge tone="violet" size="sm">
              On behalf
            </Badge>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold text-text">{person.name}</h2>
          <p className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            Week of {formatWeekRange(weekStart)}
            <SheetStatusBadge status={grid?.timesheet_status ?? person.status} />
            {person.hasLogin === false ? (
              <Badge tone="grey" size="sm">
                No login
              </Badge>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {can(PERMISSIONS.timeManageAll) ? (
            <Button
              variant="brand-outline"
              size="sm"
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setRecording(true)}
            >
              Record time on behalf
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="Close timesheet" onClick={onClose}>
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {week.isError && !grid ? (
          <LoadError
            title="Could not load the timesheet"
            error={week.error}
            onRetry={() => void week.refetch()}
            retrying={week.isRefetching}
          />
        ) : !grid ? (
          <Skeleton lines={5} />
        ) : (
          <>
            <dl className="flex flex-wrap gap-x-8 gap-y-1 text-xs">
              <div>
                <dt className="text-text-muted">Logged</dt>
                <dd className="font-semibold text-text tabular-nums">
                  {formatMinutes(grid.total_minutes)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Expected</dt>
                <dd className="font-semibold text-text tabular-nums">
                  {formatMinutes(grid.targets?.weekly_minutes ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Over or under</dt>
                <dd className="font-semibold text-text tabular-nums">{variance.text}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Billable</dt>
                <dd className="font-semibold text-text tabular-nums">
                  {formatMinutes(grid.chargeable_minutes)}
                </dd>
              </div>
              {grid.missing_days.length > 0 ? (
                <div>
                  <dt className="text-text-muted">No time on</dt>
                  <dd className="font-semibold text-text">{formatDayList(grid.missing_days)}</dd>
                </div>
              ) : null}
            </dl>
            <Card padding="none" className="overflow-hidden">
              <WeekGridTable
                grid={grid}
                rows={buildRows(grid, [], servicesByJob(entries))}
                editable={false}
                cellEntries={entriesByCell(entries)}
                closedJobs={new Set()}
              />
            </Card>
            <DataTable
              caption={`Entries of ${person.name}, week of ${formatUkDate(weekStart)}`}
              columns={columns}
              rows={entries}
              rowKey={(entry) => entry.id}
              loading={sheet.isPending && grid.timesheet_id !== null}
              empty={
                <p className="px-4 py-6 text-center text-xs text-text-muted">
                  No entries this week.
                </p>
              }
            />
          </>
        )}
      </div>
      <EntryDialog
        open={recording}
        onClose={() => setRecording(false)}
        onBehalfOf={{ id: person.userId, name: person.name }}
        defaults={{
          date:
            todayInZone(organization.timezone) >= weekStart &&
            todayInZone(organization.timezone) <= addDays(weekStart, 6)
              ? todayInZone(organization.timezone)
              : weekStart,
        }}
      />
    </>
  );
}

/**
 * One person's week for a manager: the grid (read only), the entries with who entered each one
 * (an entry recorded on behalf of someone shows both people) and the button to record time for
 * them when the caller holds `time.manage_all`.
 */
export function PersonSheetDrawer({ person, weekStart, staff, onClose }: PersonSheetDrawerProps) {
  return (
    <Sheet
      open={person !== null}
      onClose={onClose}
      label={person ? `Timesheet of ${person.name}` : 'Timesheet'}
      className="ml-auto max-w-5xl"
    >
      {person ? (
        <Content
          key={`${person.userId}-${weekStart}`}
          person={person}
          weekStart={weekStart}
          staff={staff}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}
