import { useCallback, useState } from 'react';

import type { BulkResult } from '@/types';
import { bulkSummary, describeBulkError, type BulkRefusal } from '@/utils/bulk';

import { useToast } from './toastContext';

export interface BulkFlowOptions<TBody> {
  /** Sends the call (a mutation's `mutateAsync`). */
  run: (body: TBody) => Promise<BulkResult>;
  /** "job" and "jobs", for the toast and the announcement. */
  noun: readonly [string, string];
  /** Called after a call went through (clear the selection). */
  onDone: () => void;
}

export interface BulkFlow<TBody> {
  busy: boolean;
  /** Why the last call was refused; shown in the dialog that sent it. */
  refusal: BulkRefusal | null;
  /** What the last call did, for screen readers. */
  announcement: string;
  clearRefusal: () => void;
  /** Sends `body`; true when it went through (a refusal is kept in `refusal`). */
  submit: (body: TBody, verb: string) => Promise<boolean>;
}

/**
 * The shared flow of a bulk action: send it, then either toast and announce the result and let the
 * page clear its selection, or keep the API's refusal (with the rows it names) for the dialog.
 */
export function useBulkFlow<TBody>({ run, noun, onDone }: BulkFlowOptions<TBody>): BulkFlow<TBody> {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<BulkRefusal | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const submit = useCallback(
    async (body: TBody, verb: string) => {
      setBusy(true);
      setRefusal(null);
      try {
        const result = await run(body);
        const summary = bulkSummary(result, noun, verb);
        toast({ tone: 'success', ...summary });
        setAnnouncement(
          summary.description ? `${summary.title}. ${summary.description}` : summary.title,
        );
        onDone();
        return true;
      } catch (error) {
        setRefusal(describeBulkError(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [run, noun, onDone, toast],
  );

  return { busy, refusal, announcement, clearRefusal: () => setRefusal(null), submit };
}
