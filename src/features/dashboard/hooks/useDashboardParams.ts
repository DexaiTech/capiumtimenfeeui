import { useUrlParams } from '@/hooks';

import { DEFAULT_MONTHS, DEFAULT_PERIOD, MONTH_CHOICES, isPeriod } from '../constants';
import type { ApprovalKind, DashboardPeriod } from '../types';

/*
 * What a page is showing lives in the URL (`?period=ytd`), so it survives a reload and can be
 * shared; an unknown value falls back to the page's default instead of failing.
 */

export function usePeriodParam(fallback: DashboardPeriod = DEFAULT_PERIOD) {
  const { params, setParam } = useUrlParams();
  const raw = params.get('period');
  const period = isPeriod(raw) ? raw : fallback;
  return [period, (next: DashboardPeriod) => setParam({ period: next })] as const;
}

export function useMonthsParam() {
  const { params, setParam } = useUrlParams();
  const raw = Number(params.get('months'));
  const months = (MONTH_CHOICES as ReadonlyArray<number>).includes(raw) ? raw : DEFAULT_MONTHS;
  return [months, (next: number) => setParam({ months: String(next) })] as const;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The week the Missing Timesheets page lists (any day of it); null is the last completed week. */
export function useWeekParam() {
  const { params, setParam } = useUrlParams();
  const raw = params.get('week');
  const week = raw && ISO_DATE.test(raw) ? raw : null;
  return [week, (next: string | null) => setParam({ week: next })] as const;
}

const KINDS: ReadonlyArray<ApprovalKind> = ['timesheet', 'expense', 'invoice', 'wip_adjustment'];

/** The tab of Pending Approvals: one kind, or null for all of them. */
export function useKindParam() {
  const { params, setParam } = useUrlParams();
  const raw = params.get('kind');
  const kind = KINDS.find((candidate) => candidate === raw) ?? null;
  return [kind, (next: ApprovalKind | null) => setParam({ kind: next })] as const;
}
