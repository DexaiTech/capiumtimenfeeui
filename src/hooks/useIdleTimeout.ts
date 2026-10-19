import { useCallback, useEffect, useRef, useState } from 'react';

import { IDLE_SIGN_OUT_MS, IDLE_WARNING_MS } from '@/constants/limits';

/** Events that count as the person being there. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export interface IdleTimeout {
  /** True from the warning until the person stays or the time is up. */
  warning: boolean;
  /** Whole seconds until sign-out while the warning shows. */
  secondsLeft: number;
  /** "Stay signed in": starts the idle period again. */
  stay: () => void;
}

export interface IdleTimeoutOptions {
  /** Runs once when the idle period reaches the sign-out time. */
  onTimeout: () => void;
  enabled?: boolean;
  warnAfterMs?: number;
  signOutAfterMs?: number;
}

/**
 * Warns after 25 minutes without activity and signs out after 30. Once the warning shows,
 * only `stay()` ends it: a stray mouse move must not hide a session that is about to end.
 */
export function useIdleTimeout({
  onTimeout,
  enabled = true,
  warnAfterMs = IDLE_WARNING_MS,
  signOutAfterMs = IDLE_SIGN_OUT_MS,
}: IdleTimeoutOptions): IdleTimeout {
  // Set when the timer starts (an effect), so render stays pure.
  const lastActivity = useRef(0);
  const warningRef = useRef(false);
  const timedOut = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const stay = useCallback(() => {
    lastActivity.current = Date.now();
    warningRef.current = false;
    setWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    lastActivity.current = Date.now();
    warningRef.current = false;
    timedOut.current = false;

    const onActivity = () => {
      if (!warningRef.current) lastActivity.current = Date.now();
    };
    for (const name of ACTIVITY_EVENTS)
      window.addEventListener(name, onActivity, { passive: true });

    const tick = () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= signOutAfterMs) {
        if (!timedOut.current) {
          timedOut.current = true;
          setWarning(false);
          onTimeoutRef.current();
        }
        return;
      }
      if (idle >= warnAfterMs) {
        warningRef.current = true;
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((signOutAfterMs - idle) / 1000)));
      }
    };
    const id = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(id);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
    };
  }, [enabled, warnAfterMs, signOutAfterMs]);

  return { warning, secondsLeft, stay };
}
