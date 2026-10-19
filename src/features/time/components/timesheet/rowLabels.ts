import type { GridRowModel } from '../../utils/grid';

/** "Acme Ltd · J00012 Year-end accounts · Bookkeeping": a row of the grid on one line. */
export function rowTitle(row: GridRowModel): string {
  const client = row.client_name ?? 'No client';
  const job = [row.job_number, row.job_name].filter(Boolean).join(' ');
  return [client, job || null, row.activity_name].filter(Boolean).join(' · ');
}
