import type { IsoDate, Pence } from '@/types/api';

import type { Statement, StatementEntryType } from '../types';

/** One line of the statement as the table shows it: the entries, led by the balance brought forward. */
export interface StatementLine {
  key: string;
  date: IsoDate | null;
  kind: StatementEntryType | 'opening';
  /** The id of the invoice, credit note or payment (null for the opening balance). */
  id: string | null;
  number: string | null;
  description: string;
  /** Invoices add, credit notes and payments subtract; null for the opening balance. */
  amount: Pence | null;
  balance: Pence;
}

/** The lines to show: "Balance brought forward" first when the statement starts after some history. */
export function statementLines(statement: Statement): StatementLine[] {
  const lines: StatementLine[] = [];
  if (statement.date_from !== null || statement.opening_balance !== 0) {
    lines.push({
      key: 'opening',
      date: statement.date_from,
      kind: 'opening',
      id: null,
      number: null,
      description: 'Balance brought forward',
      amount: null,
      balance: statement.opening_balance,
    });
  }
  statement.entries.forEach((entry, index) => {
    lines.push({
      key: `${entry.type}:${entry.id}:${String(index)}`,
      date: entry.date,
      kind: entry.type,
      id: entry.id,
      number: entry.number,
      description: entry.description,
      amount: entry.amount,
      balance: entry.balance,
    });
  });
  return lines;
}
