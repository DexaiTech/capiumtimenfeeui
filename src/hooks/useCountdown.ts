import { useCallback, useEffect, useState } from 'react';

/**
 * Counts down whole seconds to zero. Used for "try again in N seconds" after a 429:
 * the submit control stays disabled while `secondsLeft` is positive.
 */
export function useCountdown(): { secondsLeft: number; start: (seconds: number) => void } {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setDeadline(null);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    if (seconds > 0) setDeadline(Date.now() + seconds * 1000);
  }, []);

  return { secondsLeft, start };
}
