import { Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  DataTable,
  Select,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from '@/components/ui';
import { formatUkDate } from '@/utils/dates';

import { usePeriodLockCalendar, useLockPeriod } from '../../api/adminHooks';
import type { LockPeriodRow } from '../../adminTypes';
import { rowName } from '../../utils/periodLock';
import { describeError } from '../../utils/errors';
import { LoadError } from '../LoadError';
import type { ReopenTarget } from './ReopenDialog';

export interface PeriodGridProps {
  canLock: boolean;
  canReopen: boolean;
  /** Opens the dialog that unlocks a row, asking why. */
  onUnlock: (period: ReopenTarget) => void;
}

function StatusCell({ row }: { row: LockPeriodRow }) {
  if (row.status === 'locked') {
    return (
      <span className="flex flex-col gap-0.5">
        <Badge tone="warning" size="sm">
          Locked
        </Badge>
        {row.locked_by_name ? (
          <span className="text-xs text-text-muted">by {row.locked_by_name}</span>
        ) : null}
      </span>
    );
  }
  if (row.status === 'blocked') {
    return (
      <Badge tone="neutral" size="sm">
        Within {row.blocked_by ?? 'another lock'}
      </Badge>
    );
  }
  if (row.status === 'future') {
    return (
      <Badge tone="neutral" size="sm">
        Not ended yet
      </Badge>
    );
  }
  return (
    <Badge tone="success" size="sm">
      Open
    </Badge>
  );
}

/**
 * The periods of one accounting year in one list, each with a Lock or Unlock button: a lock is
 * exactly one of these rows, so the year is picked, not typed.
 */
export function PeriodGrid({ canLock, canReopen, onUnlock }: PeriodGridProps) {
  const { toast } = useToast();
  const [year, setYear] = useState<number | undefined>(undefined);
  const calendar = usePeriodLockCalendar(year);
  const lock = useLockPeriod();

  if (calendar.isPending) {
    return (
      <Card padding="lg" role="status" aria-label="Loading the periods">
        <p className="text-sm text-text-muted">Loading the periods…</p>
      </Card>
    );
  }
  if (calendar.isError && !calendar.data) {
    return (
      <LoadError
        title="Could not load the periods"
        error={calendar.error}
        onRetry={() => void calendar.refetch()}
        retrying={calendar.isRefetching}
      />
    );
  }
  const data = calendar.data;
  if (!data) return null;

  const yearOptions: SelectOption[] = data.years.map((entry) => ({
    value: String(entry.year),
    label: `${entry.label} (${String(entry.locked)} of ${String(entry.total)} locked)`,
  }));
  const lockedCount = data.periods.filter((row) => row.status === 'locked').length;
  const lockingRow = lock.isPending ? lock.variables : null;

  const lockRow = (row: LockPeriodRow) => {
    lock.mutate(
      { period_type: row.period_type, year: row.year, period: row.period },
      {
        onSuccess: () => toast({ tone: 'success', title: `${rowName(row)} locked` }),
        onError: (error) => toast({ tone: 'error', ...describeError(error, 'Could not lock') }),
      },
    );
  };

  const columns: DataTableColumn<LockPeriodRow>[] = [
    {
      id: 'period',
      header: 'Period',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (row) => <span className="font-medium text-text">{rowName(row)}</span>,
    },
    {
      id: 'dates',
      header: 'Dates',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="text-text-muted">
          {formatUkDate(row.start_date)} to {formatUkDate(row.end_date)}
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusCell row={row} /> },
    {
      id: 'action',
      header: 'Lock',
      align: 'end',
      cell: (row) => {
        if (row.status === 'locked' && row.lock_id) {
          const target: ReopenTarget = {
            id: row.lock_id,
            label: rowName(row),
            start_date: row.start_date,
            end_date: row.end_date,
          };
          return (
            <Button
              size="sm"
              disabled={!canReopen}
              aria-label={`Unlock ${rowName(row)}`}
              onClick={() => onUnlock(target)}
            >
              <LockOpen aria-hidden="true" className="size-4" />
              Unlock
            </Button>
          );
        }
        const pending =
          lockingRow?.year === row.year &&
          lockingRow.period === row.period &&
          lockingRow.period_type === row.period_type;
        return (
          <Button
            size="sm"
            variant="primary"
            disabled={!canLock || row.status !== 'open'}
            loading={pending}
            aria-label={`Lock ${rowName(row)}`}
            onClick={() => lockRow(row)}
          >
            <Lock aria-hidden="true" className="size-4" />
            Lock
          </Button>
        );
      },
    },
  ];

  return (
    <Card padding="lg" role="region" aria-label="Periods" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold text-text">Periods of {data.label}</h2>
          <p className="text-sm text-text-muted">
            {formatUkDate(data.start_date)} to {formatUkDate(data.end_date)} · {String(lockedCount)}{' '}
            of {String(data.periods.length)} locked. Time, expenses and WIP dated inside a locked
            period cannot be created, changed or deleted by anybody.
          </p>
        </div>
        <Select
          label="Accounting year"
          options={yearOptions}
          value={String(data.year)}
          onChange={(event) => setYear(Number(event.target.value))}
          className="w-full sm:w-64"
        />
      </div>
      <DataTable
        caption={`Periods of ${data.label}`}
        columns={columns}
        rows={data.periods}
        rowKey={(row) => `${row.period_type}-${String(row.year)}-${String(row.period)}`}
      />
    </Card>
  );
}
