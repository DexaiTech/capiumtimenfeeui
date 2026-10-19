import type { ReactNode } from 'react';

import { HealthBar } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';
import { formatMinutesLong } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import {
  CLIENT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
  labelOf,
  SOFTWARE_LABELS,
} from '../../constants';
import { formatYearEnd } from '../../format';
import type { ClientDetail, MemberRead } from '../../types';
import { AmlBadge, SegmentBadge } from '../badges';

const DASH = '—';

/** One figure of the snapshot; a dash (with the reason) when the caller's role leaves it out. */
function Stat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string | null;
  alert?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd
        className={cn('text-sm font-semibold tabular-nums', alert ? 'text-danger' : 'text-text')}
        title={value === null ? 'Your role does not include this figure' : undefined}
      >
        {value ?? DASH}
      </dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === '';
  return (
    <>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="min-w-0 text-xs font-medium break-words whitespace-pre-line text-text">
        {empty ? <span className="text-text-subtle">{DASH}</span> : children}
      </dd>
    </>
  );
}

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
    >
      <h2 id={id} className="text-base font-semibold text-text">
        {title}
      </h2>
      <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-2.5">
        {children}
      </dl>
    </section>
  );
}

export interface DetailPanelsProps {
  client: ClientDetail;
  currency: string;
  members: MemberRead[] | undefined;
}

/** The identifiers, the contact details, the practice, the notes and the money snapshot. */
export function DetailPanels({ client, currency, members }: DetailPanelsProps) {
  const money = (pence: number | null) => (pence === null ? null : formatMoney(pence, currency));
  const person = (userId: string | null) =>
    userId
      ? (members?.find((member) => member.user_id === userId)?.full_name ?? 'A former member')
      : null;
  const { financials, recurring_fees: fees } = client;
  const address = [
    client.address_line1,
    client.address_line2,
    client.city,
    client.postcode,
    client.country,
  ]
    .filter(Boolean)
    .join('\n');
  const unbilled =
    financials.unbilled_minutes === null
      ? null
      : formatMinutesLong(financials.unbilled_minutes) || '0m';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel id="client-identifiers" title="Identifiers">
        <Row label="Client code">{client.code}</Row>
        <Row label="Client type">{labelOf(CLIENT_TYPE_LABELS, client.client_type)}</Row>
        <Row label="Status">{labelOf(CLIENT_STATUS_LABELS, client.status)}</Row>
        <Row label="Company number">{client.company_number}</Row>
        <Row label="UTR">{client.utr}</Row>
        <Row label="VAT number">{client.vat_number}</Row>
        <Row label="Accounting software">
          {labelOf(SOFTWARE_LABELS, client.accounting_software)}
        </Row>
      </Panel>

      <Panel id="client-contact-details" title="Contact and address">
        <Row label="Email">{client.email}</Row>
        <Row label="Phone">{client.phone}</Row>
        <Row label="Primary contact">{client.primary_contact?.name}</Row>
        <Row label="Address">{address}</Row>
      </Panel>

      <Panel id="client-practice" title="Practice">
        <Row label="Year end">{formatYearEnd(client.year_end_month, client.year_end_day)}</Row>
        <Row label="Manager">{person(client.manager_user_id)}</Row>
        <Row label="Partner">{person(client.partner_user_id)}</Row>
        <Row label="Payment terms">
          {client.payment_terms_days === null ? null : `${client.payment_terms_days} days`}
        </Row>
        <Row label="Segment">
          {client.segment ? <SegmentBadge segment={client.segment} /> : null}
        </Row>
        <Row label="Health">
          {client.health_score === null ? null : (
            <HealthBar score={client.health_score} label="Client health" />
          )}
        </Row>
        <Row label="AML">
          <span className="flex flex-wrap items-center gap-1.5">
            <AmlBadge status={client.aml_status} />
            {client.aml_checked_on ? (
              <span className="font-normal text-text-muted">
                checked {formatUkDate(client.aml_checked_on)}
              </span>
            ) : null}
          </span>
        </Row>
      </Panel>

      <Panel id="client-notes" title="Notes">
        <Row label="Notes">{client.notes}</Row>
        <Row label="Billing notes">{client.billing_notes}</Row>
      </Panel>

      <div className="lg:col-span-2">
        <section
          aria-labelledby="client-financials"
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
        >
          <h2 id="client-financials" className="text-base font-semibold text-text">
            Financial snapshot
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <Stat label="WIP" value={money(financials.wip_total)} />
            <Stat label="WIP time" value={money(financials.wip_time_value)} />
            <Stat label="WIP disbursements" value={money(financials.wip_disbursement_value)} />
            <Stat label="Unbilled time" value={unbilled} />
            <Stat label="Outstanding" value={money(financials.outstanding_balance)} />
            <Stat
              label="Overdue"
              value={money(financials.overdue_balance)}
              alert={(financials.overdue_balance ?? 0) > 0}
            />
            <Stat label="On account" value={money(financials.on_account)} />
            <Stat label="One-off fees" value={money(fees.one_off_net)} />
            <Stat label="Recurring fees (net / yr)" value={money(fees.annual_net)} />
            <Stat label="VAT / yr" value={money(fees.annual_vat)} />
            <Stat label="Gross / yr" value={money(fees.annual_gross)} />
          </dl>
        </section>
      </div>
    </div>
  );
}
