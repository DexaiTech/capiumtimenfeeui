import type { TimeEntry, WeekGrid } from '../types';

/** What makes two entries one row of the week grid (the API groups by exactly this). */
export interface RowIdentity {
  client_id: string | null;
  job_id: string | null;
  activity_code_id: string | null;
  is_billable: boolean;
}

/** A row the person added that holds no time yet. */
export interface DraftRow extends RowIdentity {
  client_code: string | null;
  client_name: string | null;
  job_number: string | null;
  job_name: string | null;
  activity_code: string | null;
  activity_name: string | null;
  service_name: string | null;
}

export interface GridRowModel extends DraftRow {
  key: string;
  /** Minutes per day, in the order of the week's days. */
  minutes: number[];
  total_minutes: number;
  draft: boolean;
}

export function rowKey(row: RowIdentity): string {
  return [
    row.client_id ?? '',
    row.job_id ?? '',
    row.activity_code_id ?? '',
    row.is_billable ? 'billable' : 'non-billable',
  ].join('|');
}

/** One cell of the grid: a row on a day. */
export function cellKey(row: string, date: string): string {
  return `${row}#${date}`;
}

/** The row key and the date of a cell key. */
export function splitCellKey(key: string): { row: string; date: string } {
  const at = key.lastIndexOf('#');
  return { row: key.slice(0, at), date: key.slice(at + 1) };
}

/** The entries of a week sorted into the cell they belong to. */
export function entriesByCell(entries: ReadonlyArray<TimeEntry>): Map<string, TimeEntry[]> {
  const cells = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = cellKey(rowKey(entry), entry.entry_date);
    const found = cells.get(key);
    if (found) found.push(entry);
    else cells.set(key, [entry]);
  }
  return cells;
}

/** The service of each job in the week's entries (an entry has none of its own). */
export function servicesByJob(entries: ReadonlyArray<TimeEntry>): Map<string, string> {
  const services = new Map<string, string>();
  for (const entry of entries) {
    if (entry.job_id && entry.service_name) services.set(entry.job_id, entry.service_name);
  }
  return services;
}

/**
 * The rows to draw: those of the week grid, then the rows the person added that the grid does not
 * hold yet (the grid forgets a row once its last entry is gone, a draft survives until it is
 * removed or the week changes).
 */
export function buildRows(
  grid: WeekGrid,
  drafts: ReadonlyArray<DraftRow>,
  services: ReadonlyMap<string, string>,
): GridRowModel[] {
  const rows: GridRowModel[] = grid.rows.map((row) => ({
    key: rowKey(row),
    client_id: row.client_id,
    client_code: row.client_code,
    client_name: row.client_name,
    job_id: row.job_id,
    job_number: row.job_number,
    job_name: row.job_name,
    activity_code_id: row.activity_code_id,
    activity_code: row.activity_code,
    activity_name: row.activity_name,
    is_billable: row.is_billable,
    service_name: row.job_id ? (services.get(row.job_id) ?? null) : null,
    minutes: row.minutes,
    total_minutes: row.total_minutes,
    draft: false,
  }));
  const present = new Set(rows.map((row) => row.key));
  for (const draft of drafts) {
    const key = rowKey(draft);
    if (present.has(key)) continue;
    present.add(key);
    rows.push({
      ...draft,
      key,
      minutes: grid.days.map(() => 0),
      total_minutes: 0,
      draft: true,
    });
  }
  return rows;
}
