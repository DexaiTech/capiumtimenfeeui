import { useCallback } from 'react';

import { useUrlParams } from '@/hooks';

import { isIsoDate } from '../utils/weeks';

export type TimesheetView = 'day' | 'week' | 'calendar';

const VIEWS: ReadonlyArray<TimesheetView> = ['day', 'week', 'calendar'];

export interface TimesheetParams {
  view: TimesheetView;
  /** The day shown, or any day of the week or month shown. */
  date: string;
  setView: (view: TimesheetView) => void;
  setDate: (date: string) => void;
  /** Opens a day in the day view (a click in the calendar). */
  openDay: (date: string) => void;
}

/** The view and date of My Timesheet live in the URL, so a link or a reload keeps them. */
export function useTimesheetParams(today: string): TimesheetParams {
  const { params, setParam } = useUrlParams();
  const rawView = params.get('view');
  const rawDate = params.get('date');
  const view = VIEWS.find((item) => item === rawView) ?? 'week';
  const date = isIsoDate(rawDate) ? rawDate : today;
  const setView = useCallback((next: TimesheetView) => setParam({ view: next }), [setParam]);
  const setDate = useCallback((next: string) => setParam({ date: next }), [setParam]);
  const openDay = useCallback(
    (next: string) => setParam({ view: 'day', date: next }, { push: true }),
    [setParam],
  );
  return { view, date, setView, setDate, openDay };
}

/** The week of the Team page: one `date` parameter, any day of it. */
export function useDateParam(today: string): { date: string; setDate: (date: string) => void } {
  const { params, setParam } = useUrlParams();
  const raw = params.get('date');
  const date = isIsoDate(raw) ? raw : today;
  const setDate = useCallback((next: string) => setParam({ date: next }), [setParam]);
  return { date, setDate };
}
