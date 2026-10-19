import { Link } from 'react-router';

import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import type { ClientTabId, ClientOverview } from '../types';

interface KpiProps {
  label: string;
  value: string;
  caption: string;
  tab: ClientTabId;
  clientId: string;
  /** The caption is bad news (overdue money). */
  alert?: boolean;
}

/** One figure of the overview; it links to the tab that lists what it adds up. */
function Kpi({ label, value, caption, tab, clientId, alert = false }: KpiProps) {
  const { organization } = useOrg();
  return (
    <li>
      <Link
        to={routes.org.client(organization.slug, clientId, tab)}
        className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-fast ease-standard hover:border-border-strong hover:shadow-md"
      >
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className="text-xl font-semibold text-text tabular-nums">{value}</span>
        <span className={cn('text-xs', alert ? 'font-medium text-danger' : 'text-text-muted')}>
          {caption}
        </span>
      </Link>
    </li>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export interface KpiCardsProps {
  clientId: string;
  overview: ClientOverview;
}

/**
 * The six figures of the Overview. A section the API returned as null (the caller may not see it)
 * has no card at all, so there is never an empty shell or an error for something not allowed.
 */
export function KpiCards({ clientId, overview }: KpiCardsProps) {
  const { organization } = useOrg();
  const currency = organization.currency;
  const { jobs, time, wip, invoices, payments } = overview;
  const money = (pence: number) => formatMoney(pence, currency);
  const since = formatUkDate(overview.ytd_from);

  const active = jobs
    ? (jobs.by_status.not_started ?? 0) +
      (jobs.by_status.in_progress ?? 0) +
      (jobs.by_status.on_hold ?? 0)
    : 0;

  if (!jobs && !time && !wip && !invoices && !payments) return null;

  return (
    <ul aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {jobs ? (
        <Kpi
          clientId={clientId}
          tab="jobs"
          label="Active jobs"
          value={String(active)}
          caption={`${jobs.by_status.in_progress ?? 0} in progress · ${jobs.total} in total`}
        />
      ) : null}
      {time ? (
        <Kpi
          clientId={clientId}
          tab="time"
          label="Billable hours, last 30 days"
          value={formatMinutes(time.billable_minutes_30d)}
          caption={`of ${formatMinutes(time.minutes_30d)} logged${time.scope === 'own' ? ' (your own time)' : ''}`}
        />
      ) : null}
      {wip ? (
        <Kpi
          clientId={clientId}
          tab="wip"
          label="Work in progress"
          value={money(wip.total)}
          caption={`${plural(wip.item_count, 'item', 'items')} not yet billed`}
        />
      ) : null}
      {invoices ? (
        <Kpi
          clientId={clientId}
          tab="invoices"
          label="Outstanding"
          value={money(invoices.outstanding)}
          caption={invoices.overdue > 0 ? `${money(invoices.overdue)} overdue` : 'Nothing overdue'}
          alert={invoices.overdue > 0}
        />
      ) : null}
      {invoices ? (
        <Kpi
          clientId={clientId}
          tab="invoices"
          label="Billed this year"
          value={money(invoices.billed_ytd)}
          caption={`Net of VAT, since ${since}`}
        />
      ) : null}
      {payments ? (
        <Kpi
          clientId={clientId}
          tab="payments"
          label="Payments received this year"
          value={money(payments.received_ytd)}
          caption={`${plural(payments.count_ytd, 'payment', 'payments')} since ${since}`}
        />
      ) : null}
    </ul>
  );
}
