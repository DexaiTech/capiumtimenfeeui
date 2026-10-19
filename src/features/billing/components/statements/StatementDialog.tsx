import { Download, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge, Button, DataTable, DateField, Modal, type DataTableColumn } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';
import { todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { billingApi, useStatement } from '../../api';
import { STATEMENT_ENTRY_LABELS } from '../../constants';
import { useFileDownload } from '../../hooks/useFileDownload';
import type { ClientRef } from '../../types';
import { dateCell, plural } from '../../utils/format';
import { defaultStatementFrom } from '../../utils/statementPeriod';
import { statementLines, type StatementLine } from '../../utils/statementLines';
import { LoadError } from '../PageShell';

function lineColumns(slug: string, currency: string): DataTableColumn<StatementLine>[] {
  return [
    {
      id: 'date',
      header: 'Date',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (line) => <span className="text-text">{dateCell(line.date)}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      className: 'whitespace-nowrap',
      cell: (line) =>
        line.kind === 'opening' ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <Badge tone={STATEMENT_ENTRY_LABELS[line.kind].tone} size="sm">
            {STATEMENT_ENTRY_LABELS[line.kind].label}
          </Badge>
        ),
    },
    {
      id: 'number',
      header: 'Reference',
      className: 'whitespace-nowrap',
      cell: (line) =>
        line.kind === 'invoice' && line.id && line.number ? (
          <Link
            to={routes.org.invoice(slug, line.id)}
            className="font-medium text-link hover:underline"
          >
            {line.number}
          </Link>
        ) : (
          <span className="text-text">{line.number ?? '—'}</span>
        ),
    },
    {
      id: 'description',
      header: 'Description',
      className: 'min-w-48',
      cell: (line) => <span className="text-text">{line.description}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (line) =>
        line.amount === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className={cn('tabular-nums', line.amount < 0 ? 'text-success' : 'text-text')}>
            {formatMoney(line.amount, currency)}
          </span>
        ),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (line) => (
        <span className="font-semibold tabular-nums text-text">
          {formatMoney(line.balance, currency)}
        </span>
      ),
    },
  ];
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-text">{value}</dd>
      {hint ? <dd className="text-xs text-text-muted">{hint}</dd> : null}
    </div>
  );
}

export interface StatementDialogProps {
  /** Null keeps the dialog closed. */
  clientId: string | null;
  onClose: () => void;
  /** Offered with `payment.record`: email this statement for the period on show. */
  onSend?: (client: ClientRef, period: { from: string; to: string }) => void;
}

function StatementBody({
  clientId,
  onSend,
}: Omit<StatementDialogProps, 'clientId' | 'onClose'> & { clientId: string }) {
  const { organization, can } = useOrg();
  const { busy, download } = useFileDownload();
  const today = todayInZone(organization.timezone);
  const [from, setFrom] = useState(() => defaultStatementFrom(today));
  const [to, setTo] = useState(today);
  const query = useStatement(clientId, { from, to });
  const currency = organization.currency;
  const statement = query.data;
  const lines = statement ? statementLines(statement) : [];
  const swapped = from !== '' && to !== '' && from > to;

  if (query.isError && !statement) {
    return (
      <LoadError
        title="Could not load the statement"
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          {statement ? (
            <>
              <h3 className="truncate text-sm font-semibold text-text">{statement.client.name}</h3>
              <span className="text-xs text-text-muted">{statement.client.code}</span>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <DateField
            label="From"
            max={to || today}
            value={from || null}
            onChange={(value) => setFrom(value ?? '')}
          />
          <DateField
            label="To"
            min={from || null}
            max={today}
            value={to || null}
            onChange={(value) => setTo(value ?? today)}
          />
        </div>
      </div>

      {swapped ? (
        <p role="alert" className="text-sm text-danger">
          The start of the period is after its end.
        </p>
      ) : null}

      {statement ? (
        <>
          <dl
            aria-label="Statement totals"
            className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border p-3 sm:grid-cols-5"
          >
            <Figure
              label="Brought forward"
              value={formatMoney(statement.opening_balance, currency)}
            />
            <Figure label="Invoiced" value={formatMoney(statement.invoiced, currency)} />
            <Figure label="Credited" value={formatMoney(statement.credited, currency)} />
            <Figure label="Paid" value={formatMoney(statement.paid, currency)} />
            <Figure
              label="Closing balance"
              value={formatMoney(statement.closing_balance, currency)}
              hint={statement.closing_balance < 0 ? 'In credit' : undefined}
            />
          </dl>
          {statement.unallocated_cash > 0 ? (
            <p className="text-sm text-text-muted">
              {formatMoney(statement.unallocated_cash, currency)} of the cash received is on
              account: it is not allocated to an invoice yet.
            </p>
          ) : null}
        </>
      ) : null}

      <DataTable
        caption={`Statement of ${statement?.client.name ?? 'the client'}`}
        columns={lineColumns(organization.slug, currency)}
        rows={lines}
        rowKey={(line) => line.key}
        loading={query.isPending}
        empty={
          <p className="p-6 text-center text-sm text-text-muted">
            Nothing was invoiced, credited or paid in this period.
          </p>
        }
        footer={
          statement && statement.entries.length > 0 ? (
            <p className="border-t border-row-border px-4 py-3 text-xs text-text-muted">
              {plural(statement.entries.length, 'entry', 'entries')} from{' '}
              {dateCell(statement.date_from)} to {dateCell(statement.date_to)}. Invoices add to the
              balance; credit notes and payments take from it.
            </p>
          ) : statement && lines.length > 0 ? (
            // Only the balance brought forward is listed: say that nothing else happened.
            <p className="border-t border-row-border px-4 py-3 text-xs text-text-muted">
              Nothing was invoiced, credited or paid in this period.
            </p>
          ) : undefined
        }
      />

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button
          leftIcon={<Download aria-hidden="true" className="size-4" />}
          loading={busy === 'pdf'}
          disabled={swapped}
          onClick={() =>
            void download(
              'pdf',
              `statement-${statement?.client.code ?? 'client'}-${to || today}.pdf`,
              () =>
                billingApi.statementPdf(organization.id, clientId, {
                  from: from || undefined,
                  to: to || undefined,
                }),
            )
          }
        >
          Download PDF
        </Button>
        {onSend && can(P.paymentRecord) ? (
          <Button
            variant="primary"
            leftIcon={<Mail aria-hidden="true" className="size-4" />}
            disabled={swapped || !statement}
            onClick={() => {
              if (statement) onSend(statement.client, { from, to: to || today });
            }}
          >
            Email the statement
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** A client's invoices, credit notes and payments for a period, with a running balance. */
export function StatementDialog({ clientId, onClose, onSend }: StatementDialogProps) {
  return (
    <Modal
      open={clientId !== null}
      onClose={onClose}
      title="Client statement"
      description="Invoices, credit notes and payments with a running balance."
      size="lg"
    >
      {clientId !== null ? (
        // A different client starts again from the default period.
        <StatementBody key={clientId} clientId={clientId} onSend={onSend} />
      ) : null}
    </Modal>
  );
}
