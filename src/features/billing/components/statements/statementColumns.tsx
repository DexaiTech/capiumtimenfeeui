import { MoneyTone } from '@/components/ui/MoneyTone';
import { Badge, type DataTableColumn, ClientName } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

import type { StatementRow } from '../../types';
import { dateCell, plural } from '../../utils/format';

export interface StatementColumnOptions {
  currency: string;
}

const money = (pence: number, currency: string) =>
  pence === 0 ? (
    <span className="text-text-subtle">—</span>
  ) : (
    <span className="tabular-nums text-text">{formatMoney(pence, currency)}</span>
  );

/** The column ids are the API's `sort` values where the server sorts. */
export function statementColumns({
  currency,
}: StatementColumnOptions): DataTableColumn<StatementRow>[] {
  return [
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      hideable: false,
      className: 'min-w-44 max-w-72',
      cell: (row) => <ClientName name={row.client.name} code={row.client.code} />,
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.outstanding}>
          {money(row.outstanding, currency)}
        </MoneyTone>
      ),
    },
    {
      id: 'on_account',
      header: 'On account',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="in" value={row.on_account}>
          {money(row.on_account, currency)}
        </MoneyTone>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span
            className={cn(
              'font-semibold tabular-nums',
              row.balance < 0 ? 'text-success' : 'text-text',
            )}
          >
            {formatMoney(row.balance, currency)}
          </span>
          {row.balance < 0 ? <span className="text-xs text-text-muted">In credit</span> : null}
        </div>
      ),
    },
    {
      id: 'overdue',
      header: 'Overdue',
      align: 'end',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.overdue === 0 ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <div className="flex flex-col items-end">
            <span className="font-semibold tabular-nums text-danger">
              {formatMoney(row.overdue, currency)}
            </span>
            <span className="text-xs text-text-muted">
              oldest {plural(row.oldest_overdue_days, 'day', 'days')}
            </span>
          </div>
        ),
    },
    {
      id: 'last_sent',
      header: 'Last statement',
      sortable: true,
      className: 'min-w-40',
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          {row.last_statement_sent_at ? (
            <>
              <span className="text-text">{dateCell(row.last_statement_sent_at.slice(0, 10))}</span>
              {row.last_statement_to && row.last_statement_to.length > 0 ? (
                <span
                  className="max-w-48 truncate text-xs text-text-muted"
                  title={row.last_statement_to.join(', ')}
                >
                  to {row.last_statement_to.join(', ')}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-text-muted">Never sent</span>
          )}
          {row.has_recipient ? null : (
            <Badge tone="amber" size="sm">
              No email address
            </Badge>
          )}
        </div>
      ),
    },
  ];
}
