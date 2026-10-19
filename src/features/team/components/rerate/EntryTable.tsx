import type { ReactNode } from 'react';

import { Badge, DataTable, type BadgeTone, type DataTableColumn } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { SKIP_REASON_LABEL } from '../../constants';
import type { RefRead, RerateValues, StaffRef } from '../../types';
import { formatRate } from '../../utils/format';

/** One time entry of a preview or a finished run, before and after. */
export interface EntryRow {
  key: string;
  entry_date: string;
  minutes: number;
  staff: StaffRef | null;
  client: RefRead | null;
  job: RefRead | null;
  /** change | unchanged | skipped (a preview) or changed | skipped (a run). */
  outcome: string;
  skip_reason: string | null;
  old: RerateValues;
  new: RerateValues;
}

export interface EntryTableProps {
  caption: string;
  rows: ReadonlyArray<EntryRow>;
  /** Show the cost columns (the person holds `rate.read`). */
  showCost: boolean;
  /** `preview`: what will change; `applied`: what did. */
  tense: 'preview' | 'applied';
  loading?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
}

const change = (before: string, after: string) =>
  before === after ? after : `${before} → ${after}`;

const rateChange = (before: number | null, after: number | null) =>
  change(formatRate(before), formatRate(after));
const valueChange = (before: number | null, after: number | null) =>
  change(before === null ? '—' : formatMoney(before), after === null ? '—' : formatMoney(after));

/** An entry that is left alone keeps what it has: show that, not what it would have got. */
const shown = (row: EntryRow) => (row.outcome === 'skipped' ? row.old : row.new);

function outcomeOf(
  row: EntryRow,
  tense: EntryTableProps['tense'],
): { tone: BadgeTone; label: string } {
  if (row.outcome === 'skipped') {
    const reason = row.skip_reason ? (SKIP_REASON_LABEL[row.skip_reason] ?? row.skip_reason) : '';
    return { tone: 'warning', label: reason ? `Left alone · ${reason}` : 'Left alone' };
  }
  if (row.outcome === 'unchanged') return { tone: 'grey', label: 'No change' };
  return {
    tone: tense === 'preview' ? 'info' : 'success',
    label: tense === 'preview' ? 'Will change' : 'Changed',
  };
}

/**
 * The entries of a re-rate with the charge-out and cost rate and value each had and has, and
 * what happened to it: changed, left alone (and why) or unchanged.
 */
export function EntryTable({
  caption,
  rows,
  showCost,
  tense,
  loading = false,
  empty,
  footer,
}: EntryTableProps) {
  const columns: DataTableColumn<EntryRow>[] = [
    {
      id: 'date',
      header: 'Date',
      className: 'w-28 whitespace-nowrap',
      hideable: false,
      cell: (row) => <span className="text-text">{formatUkDate(row.entry_date)}</span>,
    },
    {
      id: 'staff',
      header: 'Staff',
      className: 'w-40',
      cell: (row) => <span className="text-text">{row.staff?.full_name ?? '—'}</span>,
    },
    {
      id: 'where',
      header: 'Client and job',
      className: 'min-w-48',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-text">{row.client?.name ?? '—'}</span>
          {row.job ? (
            <span className="truncate text-xs text-text-muted">{row.job.name}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      align: 'end',
      className: 'w-20 whitespace-nowrap',
      cell: (row) => <span className="text-text tabular-nums">{formatMinutes(row.minutes)}</span>,
    },
    {
      id: 'charge_rate',
      header: 'Charge-out rate',
      align: 'end',
      className: 'w-44 whitespace-nowrap',
      cell: (row) => (
        <span className="text-text tabular-nums">
          {rateChange(row.old.charge_rate, shown(row).charge_rate)}
        </span>
      ),
    },
    {
      id: 'charge_value',
      header: 'Charge-out value',
      align: 'end',
      className: 'w-44 whitespace-nowrap',
      cell: (row) => (
        <span className="text-text tabular-nums">
          {valueChange(row.old.charge_value, shown(row).charge_value)}
        </span>
      ),
    },
    ...(showCost
      ? [
          {
            id: 'cost_rate',
            header: 'Cost rate',
            align: 'end' as const,
            className: 'w-44 whitespace-nowrap',
            cell: (row: EntryRow) => (
              <span className="text-text tabular-nums">
                {rateChange(row.old.cost_rate, shown(row).cost_rate)}
              </span>
            ),
          },
          {
            id: 'cost_value',
            header: 'Cost value',
            align: 'end' as const,
            className: 'w-44 whitespace-nowrap',
            cell: (row: EntryRow) => (
              <span className="text-text tabular-nums">
                {valueChange(row.old.cost_value, shown(row).cost_value)}
              </span>
            ),
          },
        ]
      : []),
    {
      id: 'outcome',
      header: 'Result',
      className: 'w-56',
      cell: (row) => {
        const outcome = outcomeOf(row, tense);
        return (
          <Badge tone={outcome.tone} size="sm">
            {outcome.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      loading={loading}
      empty={empty}
      footer={footer}
    />
  );
}
