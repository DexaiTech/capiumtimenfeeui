import { ArrowDown, ArrowUp, CircleCheck, Trash2, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';

import { Badge, Button } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import type { GridAutosave } from '../../hooks/useGridAutosave';
import type { TimeEntry, WeekGrid } from '../../types';
import { cellKey, type GridRowModel } from '../../utils/grid';
import { describeVariance } from '../../utils/format';
import { formatDayHeader, weekdayName } from '../../utils/weeks';
import { BillableBadge } from '../badges';
import { HoursCell, type CellMove } from './HoursCell';
import { rowTitle } from './rowLabels';

export interface WeekGridTableProps {
  grid: WeekGrid;
  rows: GridRowModel[];
  /** The sheet takes edits and the person may type in the cells. */
  editable: boolean;
  /** The week's entries by cell, to find what a cell holds. */
  cellEntries: ReadonlyMap<string, TimeEntry[]>;
  /** Jobs that take no more time. */
  closedJobs: ReadonlySet<string>;
  autosave?: GridAutosave;
  onOpenEntry?: (entry: TimeEntry) => void;
  onOpenDay?: (date: string) => void;
  onRemoveDraft?: (rowKey: string) => void;
}

/**
 * The week as a table: a row per client, job and activity, a column per day, the day totals
 * against the person's targets underneath. Typing in a cell saves it (see `useGridAutosave`);
 * with `editable` off (approved, submitted, someone else's sheet) the same table is read-only.
 */
export function WeekGridTable({
  grid,
  rows,
  editable,
  cellEntries,
  closedJobs,
  autosave,
  onOpenEntry,
  onOpenDay,
  onRemoveDraft,
}: WeekGridTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const today = grid.today ?? '';
  const missing = new Set(grid.missing_days);
  const working = new Set(grid.working_days);
  const hasTargets = grid.targets !== null;

  const move = (position: string, direction: CellMove) => {
    const [row, day] = position.split(':').map(Number);
    if (row === undefined || day === undefined) return;
    const next = row + (direction === 'down' ? 1 : -1);
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${next}:${day}"]`)?.focus();
  };

  return (
    <div className="relative overflow-x-auto">
      <table
        ref={tableRef}
        aria-label={`Time recorded from ${formatUkDate(grid.week_start)} to ${formatUkDate(grid.week_end)}`}
        className="w-full min-w-[58rem] border-separate border-spacing-0 text-xs"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 h-[37px] min-w-56 border-b border-row-border bg-surface px-3 text-left font-medium text-text-muted"
            >
              Client, job and activity
            </th>
            {grid.days.map((date) => (
              <th
                key={date}
                scope="col"
                className={cn(
                  'h-[37px] min-w-28 border-b border-row-border px-1 text-right font-medium',
                  date === today ? 'text-brand-text' : 'text-text-muted',
                )}
              >
                <span className="block">{formatDayHeader(date)}</span>
                {date === today ? <span className="block text-2xs">Today</span> : null}
                {missing.has(date) ? (
                  <span className="flex items-center justify-end gap-0.5 text-2xs text-warning">
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    No time
                  </span>
                ) : null}
              </th>
            ))}
            <th
              scope="col"
              className="h-[37px] min-w-20 border-b border-row-border px-3 text-right font-medium text-text-muted"
            >
              Total
            </th>
            <th scope="col" className="h-[37px] w-10 border-b border-row-border">
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const closed = row.job_id !== null && closedJobs.has(row.job_id);
            const title = rowTitle(row);
            return (
              <tr key={row.key} data-row-key={row.key} className="hover:bg-surface-hover/40">
                <th
                  scope="row"
                  className="sticky left-0 z-[1] border-b border-row-border bg-surface px-3 py-2 text-left align-middle font-normal"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-text uppercase">
                      {row.client_name ?? 'No client'}
                    </span>
                    <span className="text-text">
                      {[row.job_number, row.job_name].filter(Boolean).join(' ') || 'No job'}
                    </span>
                    <span className="text-text-muted">
                      {row.activity_name ?? 'No activity'}
                      {row.service_name ? ` · ${row.service_name}` : ''}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      <BillableBadge billable={row.is_billable} />
                      {closed ? (
                        <Badge
                          tone="red"
                          size="sm"
                          icon={<TriangleAlert className="size-3" aria-hidden="true" />}
                        >
                          Job closed
                        </Badge>
                      ) : null}
                      {row.draft ? (
                        <Badge tone="violet" size="sm">
                          New row
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </th>
                {grid.days.map((date, dayIndex) => {
                  const key = cellKey(row.key, date);
                  const entries = cellEntries.get(key) ?? [];
                  const minutes = row.minutes[dayIndex] ?? 0;
                  const entry = entries.length === 1 ? entries[0] : undefined;
                  const cellEditable =
                    editable &&
                    !closed &&
                    entries.length <= 1 &&
                    (entry === undefined || !entry.is_locked) &&
                    autosave !== undefined;
                  const dayName = `${weekdayName(date, 'long')} ${formatUkDate(date)}`;
                  return (
                    <td
                      key={date}
                      className={cn(
                        'border-b border-row-border px-1 py-1.5 align-middle',
                        !working.has(date) && 'bg-surface-sunken/60',
                      )}
                    >
                      <HoursCell
                        position={`${rowIndex}:${dayIndex}`}
                        label={`${title}, ${dayName}`}
                        value={minutes > 0 ? formatMinutes(minutes) : ''}
                        state={autosave?.snapshot.cells[key]}
                        editable={cellEditable}
                        minutes={minutes}
                        entryCount={entries.length}
                        hasDetails={entry !== undefined && onOpenEntry !== undefined}
                        detailed={Boolean(entry?.description ?? entry?.internal_note)}
                        detailsLabel={`Details of ${title}, ${dayName}`}
                        weekend={!working.has(date)}
                        onEdit={(text) => autosave?.engine.edit(key, text)}
                        onCommit={() => autosave?.engine.commit(key)}
                        onRevert={() => autosave?.engine.revert(key)}
                        onRetry={() => autosave?.engine.retry(key)}
                        onMove={(direction) => move(`${rowIndex}:${dayIndex}`, direction)}
                        onOpenDetails={() => {
                          if (entry) onOpenEntry?.(entry);
                        }}
                        onOpenDay={() => onOpenDay?.(date)}
                      />
                    </td>
                  );
                })}
                <td className="border-b border-row-border px-3 py-2 text-right align-middle font-semibold text-text tabular-nums">
                  {formatMinutes(row.total_minutes)}
                </td>
                <td className="border-b border-row-border px-1 text-center align-middle">
                  {row.draft && onRemoveDraft ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove the row ${title}`}
                      onClick={() => onRemoveDraft(row.key)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-[1] bg-surface-sunken px-3 py-2 text-left text-xs font-semibold text-text"
            >
              Total
            </th>
            {grid.days.map((date, index) => (
              <td
                key={date}
                className="bg-surface-sunken px-3 py-2 text-right font-semibold text-text tabular-nums"
              >
                {formatMinutes(grid.day_totals[index] ?? 0)}
              </td>
            ))}
            <td className="bg-surface-sunken px-3 py-2 text-right font-semibold text-text tabular-nums">
              {formatMinutes(grid.total_minutes)}
            </td>
            <td className="bg-surface-sunken" />
          </tr>
          {hasTargets ? (
            <>
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-[1] bg-surface-sunken px-3 py-1.5 text-left font-medium text-text-muted"
                >
                  Target
                </th>
                {grid.days.map((date) => {
                  const target = grid.targets?.daily_minutes[date] ?? 0;
                  return (
                    <td
                      key={date}
                      className="bg-surface-sunken px-3 py-1.5 text-right text-text-muted tabular-nums"
                    >
                      {target > 0 ? (
                        formatMinutes(target)
                      ) : (
                        <span title="Day off">
                          <span aria-hidden="true">–</span>
                          <span className="sr-only">Day off</span>
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="bg-surface-sunken px-3 py-1.5 text-right font-medium text-text-muted tabular-nums">
                  {formatMinutes(grid.targets?.weekly_minutes ?? 0)}
                </td>
                <td className="bg-surface-sunken" />
              </tr>
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-[1] bg-surface-sunken px-3 py-1.5 text-left font-medium text-text-muted"
                >
                  Over or under target
                </th>
                {grid.days.map((date, index) => {
                  const target = grid.targets?.daily_minutes[date] ?? 0;
                  const logged = grid.day_totals[index] ?? 0;
                  const due = date <= today && (target > 0 || logged > 0);
                  const variance = describeVariance(grid.day_variance[index] ?? 0);
                  return (
                    <td
                      key={date}
                      className="bg-surface-sunken px-3 py-1.5 text-right align-top tabular-nums"
                    >
                      {due ? (
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-1 font-medium',
                            variance.kind === 'under' && 'text-warning',
                            variance.kind === 'over' && 'text-info',
                            variance.kind === 'on' && 'text-success',
                          )}
                        >
                          {variance.kind === 'under' ? (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          ) : variance.kind === 'over' ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : (
                            <CircleCheck className="size-3" aria-hidden="true" />
                          )}
                          {variance.text}
                          {variance.kind === 'under' ? (
                            <span className="sr-only"> under</span>
                          ) : null}
                          {variance.kind === 'over' ? <span className="sr-only"> over</span> : null}
                        </span>
                      ) : (
                        <span aria-hidden="true" className="text-text-subtle">
                          –
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="bg-surface-sunken px-3 py-1.5 text-right font-medium tabular-nums">
                  {describeVariance(grid.total_minutes - (grid.targets?.weekly_minutes ?? 0)).text}
                </td>
                <td className="bg-surface-sunken" />
              </tr>
            </>
          ) : null}
        </tfoot>
      </table>
    </div>
  );
}
