import { Skeleton } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useTimesheet } from '../../api';
import { refLabel } from '../../utils/format';
import { BillableBadge } from '../badges';
import { LoadError } from '../PageShell';

/** The entries of one submitted timesheet, for the approver to look through before deciding. */
export function SheetEntries({ timesheetId, person }: { timesheetId: string; person: string }) {
  const { organization } = useOrg();
  const currency = organization.currency;
  const sheet = useTimesheet(timesheetId);

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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
