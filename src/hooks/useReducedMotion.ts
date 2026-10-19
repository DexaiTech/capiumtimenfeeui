import { useMediaQuery } from './useMediaQuery';

/** For the few non-Motion effects (CSS transitions, auto-scroll). Motion itself is handled by MotionConfig. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
