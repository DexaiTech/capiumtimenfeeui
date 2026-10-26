import { FileDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Button, Card, CardHeader } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { formatUkDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { billingApi } from '../../api';
import { PAYMENT_METHOD_LABELS } from '../../constants';
import { useFileDownload } from '../../hooks/useFileDownload';
import type { InvoiceDetail } from '../../types';
import { dateCell, daysOverdue, plural } from '../../utils/format';

const cell = 'border-t border-row-border px-4 py-2.5';

/** What the invoice billed from WIP: the value of the work, what was billed, the write-on or write-off. */
export function InvoiceWipCard({ invoice }: { invoice: InvoiceDetail }) {
  const money = (pence: number) => formatMoney(pence, invoice.currency);
  const lines = invoice.lines.filter((line) => line.wip !== null);
  if (lines.length === 0) return null;
  const adjustment = (pence: number) =>
    pence === 0 ? '—' : pence < 0 ? `Write-off ${money(-pence)}` : `Write-on ${money(pence)}`;
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader
        title="Billed from WIP"
        description="The work this invoice bills, against what that work was worth. The difference is a write-on or a write-off."
      />
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs font-medium">
          <caption className="sr-only">WIP billed by each line of the invoice</caption>
          <thead>
            <tr className="text-left text-text-muted">
              <th scope="col" className="h-9 px-4">
                Line
              </th>
              <th scope="col" className="h-9 px-4">
                Items
              </th>
              <th scope="col" className="h-9 px-4 text-right">
                WIP value
              </th>
              <th scope="col" className="h-9 px-4 text-right">
                Billed
              </th>
              <th scope="col" className="h-9 px-4 text-right">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const wip = line.wip;
              if (!wip) return null;
              const parts = [
                wip.time_entry_ids.length > 0
                  ? plural(wip.time_entry_ids.length, 'time entry', 'time entries')
                  : null,
                wip.disbursement_ids.length > 0
                  ? plural(wip.disbursement_ids.length, 'disbursement', 'disbursements')
                  : null,
              ].filter(Boolean);
              return (
                <tr key={line.id}>
                  <td className={`${cell} text-text`}>{line.description}</td>
                  <td className={`${cell} text-text-muted`}>
                    {parts.length > 0 ? parts.join(', ') : plural(wip.item_count, 'item', 'items')}
                  </td>
                  <td className={`${cell} text-right tabular-nums`}>{money(wip.wip_value)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{money(wip.billed_value)}</td>
                  <td className={`${cell} text-right tabular-nums`}>
                    {adjustment(wip.adjustment)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-text">
              <th scope="row" colSpan={2} className={`${cell} text-left`}>
                Total
              </th>
              <td className={`${cell} text-right tabular-nums`}>{money(invoice.wip.wip_value)}</td>
              <td className={`${cell} text-right tabular-nums`}>
                {money(invoice.wip.billed_value)}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {adjustment(invoice.wip.adjustment)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

export interface InvoiceDetailsCardProps {
  invoice: InvoiceDetail;
  today: string;
  /** Shown when the draft may be edited. */
  onEdit?: () => void;
}

/** The header fields of the invoice: client, dates, reference, notes, email and creation. */
export function InvoiceDetailsCard({ invoice, today, onEdit }: InvoiceDetailsCardProps) {
  const { organization } = useOrg();
  const late = invoice.display_status === 'overdue' ? daysOverdue(invoice.due_date, today) : 0;
  const rows: Array<[string, ReactNode]> = [
    [
      'Client',
      invoice.client ? (
        <Link
          to={routes.org.client(organization.slug, invoice.client.id)}
          className="font-semibold text-brand-text hover:underline"
        >
          {invoice.client.name} ({invoice.client.code})
        </Link>
      ) : (
        '—'
      ),
    ],
    ['Issue date', dateCell(invoice.issue_date)],
    [
      'Due date',
      <span key="due">
        {dateCell(invoice.due_date)}
        {late > 0 ? (
          <span className="ml-2 text-danger">{plural(late, 'day', 'days')} overdue</span>
        ) : null}
      </span>,
    ],
    ['Reference', invoice.reference ?? '—'],
    ['Notes', invoice.notes ? <span className="whitespace-pre-line">{invoice.notes}</span> : '—'],
    [
      'Emailed',
      invoice.sent_at ? formatUkDateTime(invoice.sent_at, organization.timezone) : 'Not yet',
    ],
    ['Created', formatUkDateTime(invoice.created_at, organization.timezone)],
  ];
  return (
    <Card padding="none">
      <CardHeader
        title="Details"
        actions={
          onEdit ? (
            <Button size="sm" onClick={onEdit}>
              Edit details
            </Button>
          ) : undefined
        }
      />
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 px-5 py-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-text-muted">{label}</dt>
            <dd className="min-w-0 break-words text-text">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export interface InvoicePaymentsCardProps {
  invoice: InvoiceDetail;
  /** Shown to people who may record a payment on an invoice that is still owed. */
  onRecord?: () => void;
  /** Shown to people who may record payments: takes the payment off this invoice again. */
  onUnmatch?: (payment: InvoiceDetail['payments'][number]) => void;
}

/** The payments allocated to the invoice. */
export function InvoicePaymentsCard({ invoice, onRecord, onUnmatch }: InvoicePaymentsCardProps) {
  const money = (pence: number) => formatMoney(pence, invoice.currency);
  return (
    <Card padding="none">
      <CardHeader
        title="Payments"
        actions={
          onRecord ? (
            <Button size="sm" onClick={onRecord}>
              Record payment
            </Button>
          ) : undefined
        }
      />
      {invoice.payments.length === 0 ? (
        <p className="px-5 py-4 text-sm text-text-muted">No payments allocated yet.</p>
      ) : (
        <ul aria-label="Payments on the invoice" className="divide-y divide-row-border">
          {invoice.payments.map((payment) => (
            <li
              key={payment.allocation_id}
              className="flex items-start justify-between gap-3 px-5 py-3 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-text">{dateCell(payment.received_on)}</span>
                <span className="text-xs text-text-muted">
                  {(PAYMENT_METHOD_LABELS as Partial<Record<string, string>>)[payment.method] ??
                    payment.method}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums text-text">
                  {money(payment.amount)}
                </span>
                {onUnmatch ? (
                  <Button
                    size="sm"
                    aria-label={`Unmatch the payment of ${dateCell(payment.received_on)}`}
                    onClick={() => onUnmatch(payment)}
                  >
                    Unmatch
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export interface InvoiceCreditNotesCardProps {
  invoice: InvoiceDetail;
  /** Shown to people who may raise a credit note on an invoice that is still owed. */
  onRaise?: () => void;
}

/** The credit notes raised against the invoice, each with its PDF. */
export function InvoiceCreditNotesCard({ invoice, onRaise }: InvoiceCreditNotesCardProps) {
  const { organization } = useOrg();
  const { busy, download } = useFileDownload();
  const money = (pence: number) => formatMoney(pence, invoice.currency);
  return (
    <Card padding="none">
      <CardHeader
        title="Credit notes"
        actions={
          onRaise ? (
            <Button size="sm" onClick={onRaise}>
              Raise credit note
            </Button>
          ) : undefined
        }
      />
      {invoice.credit_notes.length === 0 ? (
        <p className="px-5 py-4 text-sm text-text-muted">No credit notes raised.</p>
      ) : (
        <ul aria-label="Credit notes of the invoice" className="divide-y divide-row-border">
          {invoice.credit_notes.map((note) => (
            <li key={note.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold text-text">{note.number}</span>
                <span className="text-xs text-text-muted">
                  {dateCell(note.issue_date)} · {note.reason}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums text-text">
                  {money(note.gross_total)}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Download PDF of ${note.number}`}
                  loading={busy === note.id}
                  onClick={() =>
                    void download(note.id, `${note.number}.pdf`, () =>
                      billingApi.creditNotePdf(organization.id, note.id),
                    )
                  }
                >
                  <FileDown aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
