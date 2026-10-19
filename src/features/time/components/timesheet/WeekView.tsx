import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Card, ConfirmDialog, EmptyState } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes, parseMinutes, roundUpToIncrement } from '@/utils/minutes';

import { timeApi, useJobRefs, useTimeInvalidation } from '../../api';
import { CLOSED_JOB_STATUSES, EDITABLE_SHEET_STATUSES, MAX_DAY_MINUTES } from '../../constants';
import { useGridAutosave } from '../../hooks/useGridAutosave';
import type { TimeEntry, TimeEntryCreate, WeekGrid } from '../../types';
import type { AutosaveHandlers } from '../../utils/autosave';
import { dialogError, errorCode } from '../../utils/errors';
import {
  buildRows,
  entriesByCell,
  rowKey,
  servicesByJob,
  splitCellKey,
  type DraftRow,
} from '../../utils/grid';
import { weekdayName } from '../../utils/weeks';
import { EntryDialog } from '../EntryDialog';
import { Notice } from '../Notice';
import { AddRowDialog } from './AddRowDialog';
import { rowTitle } from './rowLabels';
import { WeekGridTable } from './WeekGridTable';

export interface WeekViewProps {
  grid: WeekGrid;
  /** Every entry of the week: the grid's cells are made of them. */
  entries: ReadonlyArray<TimeEntry>;
  /** The person may record time (`time.log`). */
  canRecord: boolean;
  onOpenDay: (date: string) => void;
}

interface Refusal {
  code: string | undefined;
}

const REFUSAL_TITLE: Record<string, string> = {
  PERIOD_LOCKED: 'This period is locked',
  JOB_CLOSED: 'This job is closed',
  DAY_LIMIT_EXCEEDED: 'A day cannot hold more than 24 hours',
  TIME_LOCKED: 'This time is locked',
  CLIENT_INACTIVE: 'This client does not take new work',
};

/**
 * The week grid with its autosave: type hours in a cell and it is saved when typing pauses, rows
 * are added with a dialog, and what the API refuses (a locked period, a closed job, more than
 * 24 hours in a day) is shown next to the cell and in a banner. Keyed by week, so what is typed
 * and not saved yet is saved when the week is left.
 */
export function WeekView({ grid, entries, canRecord, onOpenDay }: WeekViewProps) {
  const { organization, can } = useOrg();
  const increment = organization.time_increment_minutes;
  const invalidate = useTimeInvalidation();
  const containerRef = useRef<HTMLDivElement>(null);
  const focusKey = useRef<string | null>(null);
  const clearResolver = useRef<((confirmed: boolean) => void) | null>(null);

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [closedByError, setClosedByError] = useState<ReadonlySet<string>>(() => new Set());
  const [clearing, setClearing] = useState<string | null>(null);

  const cellEntries = useMemo(() => entriesByCell(entries), [entries]);
  const services = useMemo(() => servicesByJob(entries), [entries]);
  const rows = buildRows(grid, drafts, services);
  const jobIds = [...new Set(rows.flatMap((row) => (row.job_id ? [row.job_id] : [])))];
  const jobRefs = useJobRefs(jobIds, can(PERMISSIONS.jobRead));
  const closedJobs = new Set(
    jobIds.filter(
      (id) =>
        closedByError.has(id) || CLOSED_JOB_STATUSES.includes(jobRefs.get(id)?.status ?? 'planned'),
    ),
  );
  const editable = canRecord && EDITABLE_SHEET_STATUSES.includes(grid.timesheet_status);

  const cellMinutes = (key: string) =>
    (cellEntries.get(key) ?? []).reduce((sum, entry) => sum + entry.minutes, 0);

  const handlers: AutosaveHandlers = {
    parse: (text) => {
      if (text.trim() === '') return null;
      const minutes = parseMinutes(text);
      if (minutes === null) return 'invalid';
      return minutes === 0 ? null : roundUpToIncrement(minutes, increment);
    },
    validate: (key, minutes) => {
      if (minutes === null) return null;
      const limit = formatMinutes(MAX_DAY_MINUTES);
      if (minutes > MAX_DAY_MINUTES) return `A day cannot hold more than ${limit}.`;
      const { date } = splitCellKey(key);
      const others = (grid.day_totals[grid.days.indexOf(date)] ?? 0) - cellMinutes(key);
      return others + minutes > MAX_DAY_MINUTES
        ? `A day cannot hold more than ${limit}: the other rows already have ${formatMinutes(others)}.`
        : null;
    },
    isUnchanged: (key, minutes) => cellMinutes(key) === (minutes ?? 0),
    confirmClear: (key) =>
      new Promise<boolean>((resolve) => {
        clearResolver.current = resolve;
        setClearing(key);
      }),
    save: async (key, minutes) => {
      const { row: rowKeyText, date } = splitCellKey(key);
      const row = rows.find((candidate) => candidate.key === rowKeyText);
      const existing = cellEntries.get(key) ?? [];
      const first = existing[0];
      try {
        if (minutes === null) {
          for (const entry of existing) await timeApi.deleteEntry(organization.id, entry.id);
        } else if (first) {
          await timeApi.updateEntry(organization.id, first.id, { minutes });
        } else if (row) {
          const body: TimeEntryCreate = { entry_date: date, minutes, is_billable: row.is_billable };
          if (row.client_id) body.client_id = row.client_id;
          if (row.job_id) body.job_id = row.job_id;
          if (row.activity_code_id) body.activity_code_id = row.activity_code_id;
          await timeApi.createEntry(organization.id, body);
        }
      } catch (error) {
        const code = errorCode(error);
        setRefusal({ code });
        const jobId = row?.job_id;
        if (code === 'JOB_CLOSED' && jobId) setClosedByError((found) => new Set(found).add(jobId));
        throw error;
      }
      setRefusal(null);
      await invalidate.entries();
    },
    describe: (error) => dialogError(error).message,
  };
  const autosave = useGridAutosave(handlers);
  const { snapshot } = autosave;

  // A row that was just added takes the focus in its first cell once it is on the page.
  useEffect(() => {
    const key = focusKey.current;
    if (!key) return;
    focusKey.current = null;
    const row = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('tr[data-row-key]') ?? [],
    ).find((candidate) => candidate.getAttribute('data-row-key') === key);
    row?.querySelector<HTMLInputElement>('input')?.focus();
  }, [rows.length]);

  const answerClear = (confirmed: boolean) => {
    clearResolver.current?.(confirmed);
    clearResolver.current = null;
    setClearing(null);
  };

  const clearingParts = clearing ? splitCellKey(clearing) : null;
  const clearingRow = clearingParts ? rows.find((row) => row.key === clearingParts.row) : undefined;

  const failures = Object.entries(snapshot.cells).flatMap(([key, cell]) => {
    if (cell.status !== 'error') return [];
    const parts = splitCellKey(key);
    const row = rows.find((candidate) => candidate.key === parts.row);
    const place = `${row ? rowTitle(row) : 'A row'}, ${weekdayName(parts.date, 'long')} ${formatUkDate(parts.date)}`;
    return [{ key, place, message: cell.message ?? 'It could not be saved.' }];
  });

  const status =
    snapshot.saving + snapshot.dirty > 0
      ? 'Saving…'
      : snapshot.failed > 0
        ? `${snapshot.failed} ${snapshot.failed === 1 ? 'change' : 'changes'} could not be saved`
        : snapshot.saved > 0
          ? 'All changes saved'
          : editable
            ? 'Changes are saved as you type'
            : '';

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        {editable ? (
          <Button
            size="sm"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setAddOpen(true)}
          >
            Add row
          </Button>
        ) : (
          <span />
        )}
        <p role="status" aria-live="polite" className="text-xs text-text-muted">
          {status}
        </p>
      </div>

      <Card padding="none" className="overflow-hidden">
        <WeekGridTable
          grid={grid}
          rows={rows}
          editable={editable}
          cellEntries={cellEntries}
          closedJobs={closedJobs}
          autosave={editable ? autosave : undefined}
          onOpenEntry={setEditing}
          onOpenDay={onOpenDay}
          onRemoveDraft={(key) =>
            setDrafts((current) => current.filter((draft) => rowKey(draft) !== key))
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Plus className="size-6" />}
            title="No time recorded this week"
            description={
              editable
                ? 'Add a row for a client and job, then type the hours of each day. Rows save as you type.'
                : 'Nothing was recorded for this week.'
            }
            action={
              editable ? (
                <Button variant="primary" onClick={() => setAddOpen(true)}>
                  Add a row
                </Button>
              ) : undefined
            }
          />
        ) : null}
      </Card>

      {failures.length > 0 ? (
        <Notice
          tone="danger"
          role="alert"
          title={
            (refusal?.code ? REFUSAL_TITLE[refusal.code] : undefined) ??
            'Some changes could not be saved'
          }
        >
          <ul className="flex flex-col gap-0.5">
            {failures.map((failure) => (
              <li key={failure.key}>
                {failure.place}: {failure.message}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <AddRowDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingKeys={new Set(rows.map((row) => row.key))}
        onAdd={(draft) => {
          focusKey.current = rowKey(draft);
          setDrafts((current) => [...current, draft]);
        }}
      />
      <EntryDialog open={editing !== null} entry={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={clearing !== null}
        onClose={() => answerClear(false)}
        onConfirm={() => answerClear(true)}
        title="Delete this time?"
        confirmLabel="Delete time"
      >
        <p>
          {clearingRow ? rowTitle(clearingRow) : 'This row'}
          {clearingParts
            ? `, ${weekdayName(clearingParts.date, 'long')} ${formatUkDate(clearingParts.date)}`
            : ''}{' '}
          will be removed from your timesheet.
        </p>
      </ConfirmDialog>
    </div>
  );
}
