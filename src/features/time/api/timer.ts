import { useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { TimerStart } from '../types';
import { useTimeInvalidation } from './invalidation';
import { timeKeys } from './keys';
import { timeApi } from './timeApi';

/** The caller's timer, or null. Needs `time.log`. */
export function useTimer({ enabled = true }: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.timer(organization.id),
    queryFn: ({ signal }) => timeApi.getTimer(organization.id, signal),
    enabled,
  });
}

/** The five things a timer does. Stopping writes an entry, so it refreshes the recorded time too. */
export function useTimerActions() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  const id = organization.id;

  const start = useMutation({
    mutationFn: (body: TimerStart) => timeApi.startTimer(id, body),
    onSettled: invalidate.timer,
  });
  const pause = useMutation({
    mutationFn: () => timeApi.pauseTimer(id),
    onSettled: invalidate.timer,
  });
  const resume = useMutation({
    mutationFn: () => timeApi.resumeTimer(id),
    onSettled: invalidate.timer,
  });
  const stop = useMutation({
    mutationFn: (description?: string | null) => timeApi.stopTimer(id, description),
    onSettled: async () => {
      await Promise.all([invalidate.timer(), invalidate.entries()]);
    },
  });
  const discard = useMutation({
    mutationFn: () => timeApi.discardTimer(id),
    onSettled: invalidate.timer,
  });

  return { start, pause, resume, stop, discard };
}
