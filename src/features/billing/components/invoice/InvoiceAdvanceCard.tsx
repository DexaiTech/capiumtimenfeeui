import { Button, Card, CardHeader, useToast } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { useAdvanceItems } from '../../api';
import type { AdvanceItem, InvoiceDetail, InvoiceLine } from '../../types';
import { describeFailure } from '../../utils/errors';
import { dateCell } from '../../utils/format';

const cell = 'border-t border-row-border px-4 py-2.5';

export interface InvoiceAdvanceCardProps {
  invoice: InvoiceDetail;
  /** Shown to people who may bill: assigns the client's work to an advance line. */
  onAssign?: (line: InvoiceLine) => void;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-text">{value}</dd>
    </div>
  );
}

function itemLabel(item: AdvanceItem): string {
  return item.description ?? (item.kind === 'time' ? 'Time' : 'Disbursement');
}

/**
 * Fees billed in advance: how much of each advance line the assigned work has used, and that work.
 * Time is assigned once the invoice is issued; taking it off returns it to WIP.
 */
export function InvoiceAdvanceCard({ invoice, onAssign }: InvoiceAdvanceCardProps) {
  const { toast } = useToast();
  const items = useAdvanceItems(invoice.id);
  const lines = invoice.lines.filter((line) => line.is_advance);
  if (lines.length === 0) return null;
  const money = (pence: number) => formatMoney(pence, invoice.currency);
  const issued = invoice.status === 'issued';

  const takeOff = (line: InvoiceLine, item: AdvanceItem) =>
    items.mutate(
      {
        lineId: line.id,
        unassign: true,
        body: {
          time_entry_ids: item.kind === 'time' ? [item.id] : [],
          disbursement_ids: item.kind === 'disbursement' ? [item.id] : [],
        },
      },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: 'Taken off the advance',
            description: `${itemLabel(item)} is unbilled WIP again.`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeFailure(error, 'Could not take it off the advance') }),
      },
    );

  return (
    <>
      {lines.map((line) => {
        const advance = line.advance;
        const assigned = advance?.items ?? [];
        return (
          <Card key={line.id} padding="none" className="overflow-hidden">
            <CardHeader
              title="Fees in advance"
              description={`${line.description}: time assigned to it leaves WIP; the invoice stays as issued.`}
              actions={
                issued && onAssign ? (
                  <Button size="sm" onClick={() => onAssign(line)}>
                    Assign time
                  </Button>
                ) : undefined
              }
            />
            <dl
              aria-label={`Use of ${line.description}`}
              className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-4"
            >
              <Figure label="Advance" value={money(advance?.amount ?? line.net_amount)} />
              <Figure label="Used" value={money(advance?.used ?? 0)} />
              <Figure label="Remaining" value={money(advance?.remaining ?? line.net_amount)} />
              <Figure label="Written off" value={money(advance?.written_off ?? 0)} />
            </dl>
            {assigned.length === 0 ? (
              <p className="border-t border-row-border px-5 py-4 text-sm text-text-muted">
                {issued
                  ? 'No time assigned yet.'
                  : 'Time can be assigned once the invoice is issued.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-xs font-medium">
                  <caption className="sr-only">Work assigned to {line.description}</caption>
                  <thead>
                    <tr className="text-left text-text-muted">
                      <th scope="col" className="h-9 px-4">
                        Date
                      </th>
                      <th scope="col" className="h-9 px-4">
                        Work
                      </th>
                      <th scope="col" className="h-9 px-4 text-right">
                        Hours
                      </th>
                      <th scope="col" className="h-9 px-4 text-right">
                        WIP value
                      </th>
                      <th scope="col" className="h-9 px-4 text-right">
                        Covered
                      </th>
                      {issued && onAssign ? (
                        <th scope="col" className="h-9 px-4">
                          <span className="sr-only">Actions</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {assigned.map((item) => (
                      <tr key={item.id}>
                        <td className={`${cell} whitespace-nowrap`}>{dateCell(item.date)}</td>
                        <td className={`${cell} text-text`}>
                          {itemLabel(item)}
                          {item.person?.full_name ? (
                            <span className="text-text-muted"> · {item.person.full_name}</span>
                          ) : null}
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>{item.hours ?? '—'}</td>
                        <td className={`${cell} text-right tabular-nums`}>
                          {money(item.wip_value)}
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>
                          {money(item.billed_value)}
                        </td>
                        {issued && onAssign ? (
                          <td className={`${cell} text-right`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Take ${itemLabel(item)} of ${dateCell(item.date)} off the advance`}
                              loading={items.isPending}
                              onClick={() => takeOff(line, item)}
                            >
                              Take off
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
