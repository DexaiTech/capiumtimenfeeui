import { Lock } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';

import { usePeriodLock } from '../../api/adminHooks';
import { GRANULARITY_PERIOD } from '../../utils/periodLock';
import { LoadError } from '../LoadError';
import { RelativeTime } from '../RelativeTime';
import { LockHistory } from './LockHistory';
import { LockSettingsCard } from './LockSettings';
import { PeriodGrid } from './PeriodGrid';
import { ReopenDialog, type ReopenTarget } from './ReopenDialog';

const CLOSED = [
  ['Time', 'logging, editing, moving and deleting entries, corrections, and stopping a timer'],
  ['Expenses', 'disbursements and expense claim lines: recording, editing, submitting, approving'],
  ['WIP', 'write-offs and their reversal'],
] as const;

const OPEN = [
  'Reading anything, the lock itself and its history',
  'Timesheet decisions (submit, approve, reject, reopen): the time on the sheet stays closed',
  'Starting, pausing and discarding a timer: only stopping one writes time',
  'Invoices, credit notes, payments and statements: billing a locked period is the point of closing it',
] as const;

function LockSkeleton() {
  return (
    <div role="status" aria-label="Loading the period lock" className="flex flex-col gap-3">
      <Skeleton shape="rect" className="h-20 w-full" />
      <Skeleton shape="rect" className="h-64 w-full" />
    </div>
  );
}

/**
 * The period lock of the practice: how it locks, the periods of an accounting year to lock and
 * unlock, what a lock closes and who changed it and why.
 */
export function PeriodLockView() {
  const { can } = useOrg();
  const lock = usePeriodLock();
  const [unlocking, setUnlocking] = useState<ReopenTarget | null>(null);

  if (lock.isPending) return <LockSkeleton />;
  if (lock.isError && !lock.data) {
    return (
      <LoadError
        title="Could not load the period lock"
        error={lock.error}
        onRetry={() => void lock.refetch()}
        retrying={lock.isRefetching}
      />
    );
  }
  const current = lock.data;
  if (!current) return null;
  const canLock = can(P.periodLockManage);
  const canReopen = can(P.periodLockReopen);
  // Locks made under another length (and any from before periods existed) are listed apart:
  // they stay in force and can be unlocked, but no row of the grid is one of them.
  const kind = GRANULARITY_PERIOD[current.settings.granularity];
  const others = current.periods.filter((period) => period.period_type !== kind);

  return (
    <>
      <LockSettingsCard settings={current.settings} canManage={canLock} />
      <PeriodGrid canLock={canLock} canReopen={canReopen} onUnlock={setUnlocking} />
      {canLock && canReopen ? null : (
        <p className="text-sm text-text-muted">
          {canLock
            ? 'Unlocking a period needs its own permission.'
            : canReopen
              ? 'Locking a period needs its own permission.'
              : 'Locking and unlocking periods need their own permissions.'}
        </p>
      )}

      {others.length > 0 ? (
        <Card padding="lg" role="region" aria-label="Earlier locks" className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Lock aria-hidden="true" className="mt-1 size-5 shrink-0 text-warning" />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-base font-semibold text-text">Earlier locks</h2>
              <p className="text-sm text-text-muted">
                Made under another way of locking. They stay in force until you unlock them.
              </p>
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {others.map((period) => (
              <li key={period.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 font-medium text-text">
                    {period.label}
                    {period.period_type === 'legacy' ? (
                      <Badge tone="neutral" size="sm">
                        Before periods
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatUkDate(period.start_date)} to {formatUkDate(period.end_date)}
                    {' · Locked '}
                    <RelativeTime iso={period.locked_at} />
                    {period.locked_by_name ? ` by ${period.locked_by_name}` : ''}
                    {period.reason ? `: ${period.reason}` : ''}
                  </span>
                </div>
                <Button
                  size="sm"
                  disabled={!canReopen}
                  aria-label={`Unlock ${period.label}`}
                  onClick={() => setUnlocking(period)}
                >
                  Unlock
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-text">What a lock closes</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-muted">
            {CLOSED.map(([area, what]) => (
              <li key={area}>
                <strong className="font-medium text-text">{area}:</strong> {what}.
              </li>
            ))}
          </ul>
        </Card>
        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-text">What stays open</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-muted">
            {OPEN.map((text) => (
              <li key={text}>{text}.</li>
            ))}
          </ul>
        </Card>
      </div>

      <LockHistory />

      <ReopenDialog period={unlocking} onClose={() => setUnlocking(null)} />
    </>
  );
}
