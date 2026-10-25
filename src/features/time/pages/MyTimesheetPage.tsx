import { Copy, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button, Card, PageToolbar, SegmentedControl, Skeleton } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { addDays, todayInZone } from '@/utils/dates';

import { useRangeEntries, useTimesheet, useWeek } from '../api';
import { EntryPanel } from '../components/EntryPanel';
import { RatesNotSetNotice } from '../components/RatesNotSetNotice';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { PeriodNavigator } from '../components/PeriodNavigator';
import { CalendarView } from '../components/timesheet/CalendarView';
import { CopyWeekDialog } from '../components/timesheet/CopyWeekDialog';
import { DayView } from '../components/timesheet/DayView';
import { TimerCard } from '../components/timesheet/TimerCard';
import { TimesheetStatusBar } from '../components/timesheet/TimesheetStatusBar';
import { WeekView } from '../components/timesheet/WeekView';
import { EDITABLE_SHEET_STATUSES } from '../constants';
import { useTimesheetParams, type TimesheetView } from '../hooks/useTimesheetParams';
import { addMonths, formatLongDay, formatWeekRange, monthLabel, weekStartOf } from '../utils/weeks';

const VIEWS: ReadonlyArray<{ value: TimesheetView; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'calendar', label: 'Calendar' },
];

function GridSkeleton() {
  return (
    <Card padding="md" aria-busy="true" aria-label="Loading the week">
      <Skeleton lines={6} />
    </Card>
  );
}

function WeekPanel({
  weekStart,
  canRecord,
  onOpenDay,
}: {
  weekStart: string;
  canRecord: boolean;
  onOpenDay: (date: string) => void;
}) {
  const week = useWeek('me', weekStart);
  const entries = useRangeEntries('me', weekStart, addDays(weekStart, 6));
  const sheet = useTimesheet(week.data?.timesheet_id);

  if ((week.isError && !week.data) || (entries.isError && !entries.data)) {
    const failed = week.isError ? week : entries;
    return (
      <LoadError
        title="Could not load the week"
        error={failed.error}
        onRetry={() => {
          void week.refetch();
          void entries.refetch();
        }}
        retrying={week.isRefetching || entries.isRefetching}
      />
    );
  }
  if (!week.data || !entries.data) return <GridSkeleton />;

  return (
    <>
      <TimesheetStatusBar grid={week.data} sheet={sheet.data} canRecord={canRecord} />
      <WeekView
        key={week.data.week_start}
        grid={week.data}
        entries={entries.data}
        canRecord={canRecord}
        onOpenDay={onOpenDay}
      />
    </>
  );
}

/**
 * My Timesheet: record time by day, by week (a grid that saves as you type) or in a month
 * calendar, run the timer, copy time forward and submit the week for approval.
 */
export default function MyTimesheetPage() {
  useDocumentTitle('My Timesheet');
  const { organization, can } = useOrg();
  const canRecord = can(PERMISSIONS.timeLog);
  const today = todayInZone(organization.timezone);
  const { view, date, setView, setDate, openDay } = useTimesheetParams(today);
  const [adding, setAdding] = useState(false);
  const [copying, setCopying] = useState(false);

  const weekStart = weekStartOf(date, organization.week_start);
  // The grid reads the same week the page is on, so the copy button knows whether it is open.
  const week = useWeek('me', weekStart, { enabled: canRecord && view === 'week' });
  const weekEditable =
    week.data !== undefined && EDITABLE_SHEET_STATUSES.includes(week.data.timesheet_status);

  if (!canRecord) {
    return (
      <PageShell title="My Timesheet">
        <NoAccess what="recording time" />
      </PageShell>
    );
  }

  const navigator =
    view === 'week'
      ? {
          unit: 'week' as const,
          label: formatWeekRange(weekStart),
          previous: addDays(weekStart, -7),
          next: addDays(weekStart, 7),
          todayLabel: 'This week',
        }
      : view === 'day'
        ? {
            unit: 'day' as const,
            label: formatLongDay(date),
            previous: addDays(date, -1),
            next: addDays(date, 1),
            todayLabel: 'Today',
          }
        : {
            unit: 'month' as const,
            label: monthLabel(date),
            previous: addMonths(date, -1),
            next: addMonths(date, 1),
            todayLabel: 'This month',
          };

  const defaultDate =
    view === 'day'
      ? date
      : today >= weekStart && today <= addDays(weekStart, 6)
        ? today
        : weekStart;

  return (
    <PageShell
      title="My Timesheet"
      description="Record time by day, week or calendar, and submit the week for approval."
      actions={
        <>
          {view === 'week' && weekEditable ? (
            <Button
              leftIcon={<Copy className="size-4" aria-hidden="true" />}
              onClick={() => setCopying(true)}
            >
              Copy previous week
            </Button>
          ) : null}
          <Button
            variant="brand-outline"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setAdding(true)}
          >
            Add entry
          </Button>
        </>
      }
    >
      <EntryPanel open={adding} onClose={() => setAdding(false)} defaults={{ date: defaultDate }} />
      <RatesNotSetNotice />
      <TimerCard />
      <PageToolbar
        start={
          <PeriodNavigator
            label={navigator.label}
            unit={navigator.unit}
            onPrevious={() => setDate(navigator.previous)}
            onNext={() => setDate(navigator.next)}
            onToday={() => setDate(today)}
            todayLabel={navigator.todayLabel}
            date={date}
            onDateChange={setDate}
          />
        }
        actions={<SegmentedControl label="View" options={VIEWS} value={view} onChange={setView} />}
      />

      {view === 'week' ? (
        <WeekPanel weekStart={weekStart} canRecord={canRecord} onOpenDay={openDay} />
      ) : view === 'day' ? (
        <DayView date={date} canRecord={canRecord} onAddEntry={() => setAdding(true)} />
      ) : (
        <CalendarView date={date} onOpenDay={openDay} />
      )}

      <CopyWeekDialog
        open={copying}
        onClose={() => setCopying(false)}
        fromWeekStart={addDays(weekStart, -7)}
        toWeekStart={weekStart}
      />
    </PageShell>
  );
}
