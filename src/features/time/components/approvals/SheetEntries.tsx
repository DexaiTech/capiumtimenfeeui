import { useState } from 'react';

import { Badge, Button, Skeleton, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useApproveOvertime, useOvertime, useRejectOvertime, useTimesheet } from '../../api';
import type { OvertimeItem, TimeEntry } from '../../types';
import { describeFailure } from '../../utils/errors';
import { refLabel } from '../../utils/format';
import { BillableBadge, OvertimeStatusBadge } from '../badges';
import { LoadError } from '../PageShell';
import { ReasonDialog } from '../ReasonDialog';

/** The overtime of the sheet's person and week, shown when the practice has overtime on. */
export interface SheetOvertime {
  userId: string;
  from: string;
  to: string;
  /** The approver may approve or reject it (nobody decides on their own time). */
  canDecide: boolean;
}

export interface SheetEntriesProps {
  timesheetId: string;
  person: string;
  overtime?: SheetOvertime;
}

/** The overtime cell of an entry: the mark, its hours and status, and the decision. */
function OvertimeCell({
  entry,
  item,
  canDecide,
  onReject,
}: {
  entry: TimeEntry;
  item: OvertimeItem | undefined;
  canDecide: boolean;
  onReject: (item: OvertimeItem) => void;
}) {
  const { toast } = useToast();
  const approve = useApproveOvertime();
  if (!item && !entry.is_overtime) return <>—</>;
  const mark = (
    <Badge tone="warning" size="sm">
      Overtime
    </Badge>
  );
  if (!item) return mark;
  const what = `the overtime of ${formatMinutes(item.overtime_minutes)} on ${formatUkDate(item.entry_date)}`;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        {mark}
        <span className="font-semibold tabular-nums">{formatMinutes(item.overtime_minutes)}</span>
        <OvertimeStatusBadge status={item.status} />
      </span>
      {item.status === 'rejected' && item.decision_note ? (
        <span className="text-text-muted">{item.decision_note}</span>
      ) : null}
      {item.status === 'pending' && canDecide ? (
        <span className="flex gap-1.5">
          <Button
            size="sm"
            variant="brand-outline"
            loading={approve.isPending}
            aria-label={`Approve ${what}`}
            onClick={() =>
              approve.mutate(item.id, {
                onSuccess: () =>
                  toast({
                    tone: 'success',
                    title: 'Overtime approved',
                    description: `${item.user.full_name}, ${formatMinutes(item.overtime_minutes)} on ${formatUkDate(item.entry_date)}`,
                  }),
                onError: (error) => {
                  const notice = describeFailure(error, 'Could not approve the overtime');
                  toast({ tone: 'error', title: notice.title, description: notice.description });
                },
              })
            }
          >
            Approve
          </Button>
          <Button size="sm" aria-label={`Reject ${what}`} onClick={() => onReject(item)}>
            Reject
          </Button>
        </span>
      ) : null}
    </div>
  );
}

/**
 * The entries of one submitted timesheet, for the approver to look through before deciding. With
 * overtime on, entries with an overtime portion are marked and pending overtime is approved or
 * rejected here, one entry at a time.
 */
export function SheetEntries({ timesheetId, person, overtime }: SheetEntriesProps) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const currency = organization.currency;
  const sheet = useTimesheet(timesheetId);
  const overtimeItems = useOvertime(
    { user_id: overtime?.userId, from: overtime?.from, to: overtime?.to },
    { enabled: overtime !== undefined },
  );
  const reject = useRejectOvertime();
  const [rejecting, setRejecting] = useState<OvertimeItem | null>(null);
  const byEntry = new Map((overtimeItems.data ?? []).map((item) => [item.time_entry_id, item]));

  if (sheet.isError) {
    return (
      <LoadError
        title="Could not load the entries"
        error={sheet.error}
        onRetry={() => void sheet.refetch()}
        retrying={sheet.isRefetching}
      />
    );
  }
  if (!sheet.data) {
    return (
      <div role="status" aria-label="Loading the entries">
        <Skeleton lines={3} />
      </div>
    );
  }

  const entries = [...sheet.data.entries].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at),
  );
  if (entries.length === 0) {
    return <p className="text-xs text-text-muted">This timesheet has no entries.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-xs">
        <caption className="sr-only">Entries of {person}</caption>
        <thead>
          <tr className="text-left text-text-muted">
            <th scope="col" className="pr-3 pb-1.5 font-medium">
              Date
            </th>
            <th scope="col" className="pr-3 pb-1.5 font-medium">
              Client and job
            </th>
            <th scope="col" className="pr-3 pb-1.5 font-medium">
              Activity
            </th>
            <th scope="col" className="pr-3 pb-1.5 font-medium">
              Description
            </th>
            <th scope="col" className="pr-3 pb-1.5 text-right font-medium">
              Time
            </th>
            <th scope="col" className="pr-3 pb-1.5 font-medium">
              Billable
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Value
            </th>
            {overtime ? (
              <th scope="col" className="pb-1.5 pl-3 font-medium">
                Overtime
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t border-row-border align-top">
              <td className="py-1.5 pr-3 whitespace-nowrap">{formatUkDate(entry.entry_date)}</td>
              <td className="py-1.5 pr-3">
                <span className="block font-semibold text-text uppercase">
                  {entry.client_name ?? 'No client'}
                </span>
                <span className="block text-text-muted">
                  {refLabel({ code: entry.job_number, name: entry.job_name }) || 'No job'}
                </span>
              </td>
              <td className="py-1.5 pr-3">{entry.activity_name ?? '—'}</td>
              <td className="py-1.5 pr-3">{entry.description ?? '—'}</td>
              <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                {formatMinutes(entry.minutes)}
              </td>
              <td className="py-1.5 pr-3">
                <BillableBadge billable={entry.is_billable} />
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {formatMoney(entry.charge_value, currency)}
              </td>
              {overtime ? (
                <td className="py-1.5 pl-3">
                  <OvertimeCell
                    entry={entry}
                    item={byEntry.get(entry.id)}
                    canDecide={overtime.canDecide}
                    onReject={setRejecting}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <ReasonDialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Reject this overtime"
        description={
          rejecting
            ? `${rejecting.user.full_name}, ${formatMinutes(rejecting.overtime_minutes)} on ${formatUkDate(rejecting.entry_date)}`
            : undefined
        }
        label="Note"
        hint="Required. The hours stay on the timesheet at the standard cost; only the overtime premium is removed."
        requiredMessage="Enter a note for rejecting the overtime"
        submitLabel="Reject overtime"
        onSubmit={async (note) => {
          if (!rejecting) return;
          const item = rejecting;
          await reject.mutateAsync({ overtimeId: item.id, note });
          toast({
            tone: 'success',
            title: 'Overtime rejected',
            description: `${item.user.full_name}, ${formatMinutes(item.overtime_minutes)} on ${formatUkDate(item.entry_date)}`,
          });
        }}
      />
    </div>
  );
}
