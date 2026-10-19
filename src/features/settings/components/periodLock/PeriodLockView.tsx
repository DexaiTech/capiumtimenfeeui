import { Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';

import { Button, Card, Skeleton } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';

import { usePeriodLock } from '../../api/adminHooks';
import { LoadError } from '../LoadError';
import { RelativeTime } from '../RelativeTime';
import { LockDialog } from './LockDialog';
import { LockHistory } from './LockHistory';
import { ReopenDialog } from './ReopenDialog';

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
      <Skeleton shape="rect" className="h-36 w-full" />
      <Skeleton shape="rect" className="h-40 w-full" />
    </div>
  );
}

/** The period lock of the practice: where it stands, what it closes, who changed it and why. */
export function PeriodLockView() {
  const { can } = useOrg();
  const lock = usePeriodLock();
  const [dialog, setDialog] = useState<'lock' | 'reopen' | null>(null);

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
  const through = current.locked_through;
  const last = current.last_event;
  const canLock = can(P.periodLockManage);
  const canReopen = can(P.periodLockReopen);

  return (
    <>
      <Card padding="lg" role="region" aria-label="Current lock" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {through ? (
            <Lock aria-hidden="true" className="mt-1 size-6 shrink-0 text-warning" />
          ) : (
            <LockOpen aria-hidden="true" className="mt-1 size-6 shrink-0 text-success" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-semibold text-text">
              {through ? `Locked through ${formatUkDate(through)}` : 'Nothing is locked'}
            </h2>
            <p className="text-sm text-text-muted">
              {through
                ? 'Time, expenses and WIP dated on or before this day cannot be created, changed or deleted by anybody.'
                : 'Every day is open. Lock a period once its time, expenses and WIP have been reported.'}
            </p>
            {last ? (
              <p className="text-xs text-text-subtle">
                {last.event_type === 'locked' ? 'Locked' : 'Reopened'}{' '}
                <RelativeTime iso={last.created_at} />
                {last.actor_name ? ` by ${last.actor_name}` : ''}
                {last.reason ? `: ${last.reason}` : ''}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" disabled={!canLock} onClick={() => setDialog('lock')}>
            Lock a period
          </Button>
          <Button disabled={!canReopen || through === null} onClick={() => setDialog('reopen')}>
            Reopen a period
          </Button>
        </div>
        {canLock && canReopen ? null : (
          <p className="text-sm text-text-muted">
            {canLock
              ? 'Reopening a period needs its own permission.'
              : canReopen
                ? 'Locking a period needs its own permission.'
                : 'Locking and reopening periods need their own permissions.'}
          </p>
        )}
      </Card>

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

      <LockDialog open={dialog === 'lock'} onClose={() => setDialog(null)} currentLock={through} />
      {through ? (
        <ReopenDialog
          open={dialog === 'reopen'}
          onClose={() => setDialog(null)}
          currentLock={through}
        />
      ) : null}
    </>
  );
}
