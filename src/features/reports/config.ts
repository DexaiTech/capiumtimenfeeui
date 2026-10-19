import type { ReactNode } from 'react';

import type { DataTableColumn } from '@/components/ui';

import type { Stat } from './components/StatCards';
import type { ExportFormat } from './types';

/** The filters a report offers; each maps to the endpoint's parameter of the same meaning. */
export type FilterKey =
  'client' | 'job' | 'user' | 'partner' | 'manager' | 'service' | 'activity' | 'method' | 'status';

/** The search param of a filter and the query parameter of the endpoint it becomes. */
export const FILTER_PARAMS: Record<FilterKey, { param: string; query: string }> = {
  client: { param: 'client', query: 'client_id' },
  job: { param: 'job', query: 'job_id' },
  user: { param: 'user', query: 'user_id' },
  partner: { param: 'partner', query: 'partner_user_id' },
  manager: { param: 'manager', query: 'manager_user_id' },
  service: { param: 'service', query: 'service_id' },
  activity: { param: 'activity', query: 'activity_code_id' },
  method: { param: 'method', query: 'method' },
  status: { param: 'status', query: 'status' },
};

/** How the period of a report is chosen. */
export type PeriodKind =
  /** `date_from` .. `date_to`. */
  | 'range'
  /** `as_at`: balances as at a day. */
  | 'as_at'
  /** `week_from` .. `week_to`: any day of the first and of the last week. */
  | 'weeks';

/** What a report's columns, figures and chart are worked out from. */
export interface ReportContext<TTotals> {
  currency: string;
  /** The practice's time zone, for times of day. */
  timeZone: string;
  /** The practice's slug, for links to the records behind a row. */
  slug: string;
  /** The grouping on show (`group_by`), when the report has one. */
  group: string | undefined;
  totals: TTotals | undefined;
}

/** The period on show, for the links that open the records behind a row. */
export interface ReportPeriod {
  from: string;
  to: string;
  asAt: string;
}

/**
 * One report: which endpoint, which filters and how its rows, totals and chart read. The screen
 * (`ReportScreen`) does the rest: the period, the filters, the export, the table and its states.
 */
export interface ReportConfig<TRow, TTotals> {
  /** The path below `/reports/`. */
  endpoint: string;
  /** Names the downloaded file. */
  fileName: string;
  title: string;
  description: string;
  /** What the report is called in "You don't have access to …". */
  what: string;
  /** Any of these permissions opens the report. */
  access: ReadonlyArray<string>;
  period: PeriodKind;
  /** The period preset a range report opens on (else the API's: this month). */
  defaultPreset?: 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'last-12-months';
  /** The groupings the report offers (the first is the default). */
  groups?: ReadonlyArray<{ value: string; label: string }>;
  filters: ReadonlyArray<FilterKey>;
  /** What the person filter picks: "Person", "Claimant". */
  personLabel?: string;
  /** The files the report downloads as (default: CSV, Excel and PDF). */
  formats?: ReadonlyArray<ExportFormat>;
  rowKey: (row: TRow) => string;
  /** What a row is called, for its actions menu. */
  rowLabel: (row: TRow) => string;
  columns: (context: ReportContext<TTotals>) => DataTableColumn<TRow>[];
  stats: (totals: TTotals, context: ReportContext<TTotals>) => Stat[];
  chart?: (data: { rows: TRow[]; totals: TTotals }, context: ReportContext<TTotals>) => ReactNode;
  /** The page (below the practice, with its query) that lists the records behind a row. */
  drill?: (
    row: TRow,
    context: ReportContext<TTotals>,
    period: ReportPeriod,
  ) => { label: string; to: string } | null;
  /** A line under the table, for what the report cannot say in its columns. */
  note?: string;
  emptyTitle: string;
  emptyDescription: string;
}
