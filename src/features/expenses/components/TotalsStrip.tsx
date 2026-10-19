import { Card } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import type { ClaimTotals } from '../types';

export interface TotalsStripProps {
  totals: ClaimTotals;
  currency: string;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-base font-semibold text-text tabular-nums">{value}</dd>
      {hint ? <p className="text-2xs text-text-subtle">{hint}</p> : null}
    </div>
  );
}

/** The sums of a claim: what was spent, the VAT in it, what is recharged and what is owed back. */
export function TotalsStrip({ totals, currency }: TotalsStripProps) {
  const money = (pence: number) => formatMoney(pence, currency);
  return (
    <Card padding="sm">
      <dl aria-label="Totals of the claim" className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Net" value={money(totals.net)} />
        <Stat label="VAT" value={money(totals.vat)} />
        <Stat label="Gross" value={money(totals.gross)} />
        <Stat label="Recharged to clients" value={money(totals.recharge)} />
        <Stat
          label="To reimburse"
          value={money(totals.reimbursable)}
          hint="What staff paid themselves"
        />
      </dl>
    </Card>
  );
}
