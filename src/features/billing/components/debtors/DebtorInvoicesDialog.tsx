import { Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge, Button, DataTable, Modal, type DataTableColumn } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import { useDebtorInvoices } from '../../api';
import type { ClientRef, DebtorInvoice } from '../../types';
import { dateCell, plural } from '../../utils/format';
import { LoadError } from '../PageShell';
import { AgeingBar } from './AgeingSummary';

function invoiceColumns(slug: string, currency: string): DataTableColumn<DebtorInvoice>[] {
  const money = (pick: (row: DebtorInvoice) => number) => (row: DebtorInvoice) => (
    <span className="tabular-nums text-text">{formatMoney(pick(row), currency)}</span>
  );
  return [
    {
      id: 'number',
      header: 'Invoice',
      hideable: false,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          {row.number ? (
            <Link
              to={routes.org.invoice(slug, row.id)}
              className="font-medium text-link hover:underline"
            >
              {row.number}
            </Link>
          ) : (
            <span className="text-text-muted">Draft</span>
          )}
          {row.source === 'opening' ? (
            <Badge tone="grey" size="sm">
              Opening
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'issued',
      header: 'Issued',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{dateCell(row.issue_date)}</span>,
    },
    {
      id: 'due',
      header: 'Due',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-text">{dateCell(row.due_date)}</span>
          <span
            className={row.days_overdue > 0 ? 'text-xs text-danger' : 'text-xs text-text-muted'}
          >
            {row.days_overdue > 0
              ? `${plural(row.days_overdue, 'day', 'days')} overdue`
              : 'Not due yet'}
          </span>
        </div>
      ),
    },
    { id: 'gross', header: 'Total', align: 'end', cell: money((row) => row.gross_total) },
    { id: 'paid', header: 'Paid', align: 'end', cell: money((row) => row.paid) },
    { id: 'credited', header: 'Credited', align: 'end', cell: money((row) => row.credited) },
    {
      id: 'outstanding',
      header: 'Outstanding',
      align: 'end',
      cell: (row) => (
        <span className="font-semibold tabular-nums text-text">
          {formatMoney(row.outstanding, currency)}
        </span>
      ),
    },
    {
      id: 'reminders',
      header: 'Reminders',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.reminder_count > 0 ? (
          <span className="text-text">
            {row.reminder_count}, last {dateCell(row.last_reminder_at?.slice(0, 10))}
          </span>
        ) : (
          <span className="text-text-muted">None</span>
        ),
    },
  ];
}

export interface DebtorInvoicesDialogProps {
  /** Null keeps the dialog closed. */
  client: ClientRef | null;
  asAt: string;
  onClose: () => void;
  /** Offered with `payment.record`: remind about these invoices. */
  onRemind?: (invoiceIds: string[], label: string) => void;
}

function Body({
  client,
  asAt,
  onRemind,
}: Omit<DebtorInvoicesDialogProps, 'onClose'> & { client: ClientRef }) {
  const { organization } = useOrg();
  const query = useDebtorInvoices(client.id, asAt);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const currency = organization.currency;
  const data = query.data;
  const chosen = (data?.invoices ?? []).filter((invoice) => selected.has(invoice.id));

  if (query.isError) {
    return (
      <LoadError
        title="Could not load the invoices"
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            {formatMoney(data.totals.total, currency)} owed on{' '}
            {plural(data.invoices.length, 'invoice', 'invoices')}.
          </p>
          <AgeingBar amounts={data.totals} label={`Ageing of ${client.name}`} currency={currency} />
        </div>
      ) : null}
      <DataTable
        caption={`Open invoices of ${client.name}`}
        columns={invoiceColumns(organization.slug, currency)}
        rows={data?.invoices ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        selectable={onRemind !== undefined}
        selected={selected}
        onSelectedChange={setSelected}
        selectLabel={(row) => `Select ${row.number ?? 'draft'}`}
        empty={<p className="p-6 text-center text-sm text-text-muted">Nothing is owed.</p>}
      />
      {onRemind ? (
        <div className="flex justify-end">
          <Button
            variant="primary"
            leftIcon={<Mail aria-hidden="true" className="size-4" />}
            disabled={chosen.length === 0}
            onClick={() =>
              onRemind(
                chosen.map((invoice) => invoice.id),
                `${client.name} about ${plural(chosen.length, 'invoice', 'invoices')}`,
              )
            }
          >
            {chosen.length > 0
              ? `Remind about ${plural(chosen.length, 'invoice', 'invoices')}`
              : 'Remind about selected invoices'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** One debtor's open invoices, oldest due first, with the reminders already sent. */
export function DebtorInvoicesDialog({
  client,
  asAt,
  onClose,
  onRemind,
}: DebtorInvoicesDialogProps) {
  return (
    <Modal
      open={client !== null}
      onClose={onClose}
      title="Open invoices"
      description={client ? `${client.name}, as at ${dateCell(asAt)}` : undefined}
      size="lg"
    >
      {client ? <Body client={client} asAt={asAt} onRemind={onRemind} /> : null}
    </Modal>
  );
}
