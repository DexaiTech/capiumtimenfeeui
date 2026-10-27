import { ClientName } from '@/components/ui';
import type { ReactNode } from 'react';

import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

const dash = <span className="text-text-subtle">—</span>;

/** Pence as money, a dash when there is none to show (a hidden cost, a zero). */
export function money(pence: number | null | undefined, currency: string, zero = true): ReactNode {
  if (pence === null || pence === undefined || (!zero && pence === 0)) return dash;
  return <span className="tabular-nums text-text">{formatMoney(pence, currency)}</span>;
}

export function minutes(value: number | null | undefined): ReactNode {
  return <span className="tabular-nums text-text">{formatMinutes(value)}</span>;
}

/** Basis points as a percentage, a dash when the denominator was zero. */
export function percent(bp: number | null | undefined): ReactNode {
  return bp === null || bp === undefined ? (
    dash
  ) : (
    <span className="tabular-nums text-text">{formatBasisPoints(bp)}</span>
  );
}

export function count(value: number): ReactNode {
  return <span className="tabular-nums text-text">{value}</span>;
}

export function date(value: string | null | undefined): ReactNode {
  return value ? <span className="text-text">{formatUkDate(value)}</span> : dash;
}

/** A client with its code under the name, drawn as the Clients grid draws it. */
export function clientNamed(name: string, code?: string | null): ReactNode {
  return <ClientName name={name} code={code} />;
}

/** A name with its code (client code, job number) under it. */
export function named(name: string, detail?: string | null): ReactNode {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-text" title={name}>
        {name}
      </span>
      {detail ? <span className="truncate text-xs text-text-muted">{detail}</span> : null}
    </div>
  );
}

/** A signed difference in basis points, red when below the target. */
export function variance(bp: number | null | undefined): ReactNode {
  if (bp === null || bp === undefined) return dash;
  return (
    <span className={bp < 0 ? 'tabular-nums text-danger' : 'tabular-nums text-success'}>
      {bp > 0 ? '+' : ''}
      {formatBasisPoints(bp)}
    </span>
  );
}
