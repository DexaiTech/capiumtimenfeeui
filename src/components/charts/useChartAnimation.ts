import { useReducedMotion } from '@/hooks';

/** Whether chart animation may run: off for users who prefer reduced motion and in jsdom. */
export function useChartAnimation(): boolean {
  const reduced = useReducedMotion();
  const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  return !reduced && !isJsdom;
}
