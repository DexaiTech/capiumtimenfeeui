import { useCallback, useState, type ReactNode } from 'react';

import { ConfirmDialog } from '@/components/ui';
import { addDays } from '@/utils/dates';
import { formatMinutesLong } from '@/utils/minutes';

import type { OvertimeConfirmationDetails } from '../types';
import { overtimeToConfirm } from '../utils/errors';

interface Question {
  details: OvertimeConfirmationDetails;
  answer: (confirmed: boolean) => void;
}

export interface OvertimeConfirm {
  /**
   * Runs a write without `confirm_overtime`. When the API answers that it adds overtime, asks the
   * person and, if they confirm, runs it again with `confirm: true`. Resolves to what the write
   * returned, or null when the person cancelled (nothing was saved). Other refusals reject.
   */
  run: <T>(write: (confirm: boolean) => Promise<T>) => Promise<T | null>;
  /** The "Add overtime hours?" dialog: render it wherever the hook is used. */
  dialog: ReactNode;
}

/** A calendar month runs from the 1st to its last day; any other period is a week (Mon to Sun). */
function periodName(details: OvertimeConfirmationDetails): 'week' | 'month' {
  return details.period_start.endsWith('-01') && addDays(details.period_end, 1).endsWith('-01')
    ? 'month'
    : 'week';
}

/**
 * The overtime warning of every time write (APT81): hours beyond a person's standard hours are
 * overtime, and the API saves them only once the person confirms. Several writes may ask at
 * once (cells of the week grid): they are asked one after the other.
 */
export function useOvertimeConfirm(): OvertimeConfirm {
  const [questions, setQuestions] = useState<ReadonlyArray<Question>>([]);
  const current = questions[0];

  const ask = useCallback(
    (details: OvertimeConfirmationDetails) =>
      new Promise<boolean>((resolve) => {
        const question: Question = {
          details,
          answer: (confirmed) => {
            setQuestions((waiting) => waiting.filter((item) => item !== question));
            resolve(confirmed);
          },
        };
        setQuestions((waiting) => [...waiting, question]);
      }),
    [],
  );

  const run = useCallback(
    async <T,>(write: (confirm: boolean) => Promise<T>): Promise<T | null> => {
      try {
        return await write(false);
      } catch (error) {
        const details = overtimeToConfirm(error);
        if (!details) throw error;
        if (!(await ask(details))) return null;
        return write(true);
      }
    },
    [ask],
  );

  const dialog = (
    <ConfirmDialog
      open={current !== undefined}
      onClose={() => current?.answer(false)}
      onConfirm={() => current?.answer(true)}
      title="Add overtime hours?"
      confirmLabel="Add overtime"
      tone="default"
    >
      <p>You are adding overtime hours. Are you sure?</p>
      {current ? (
        <p>
          {formatMinutesLong(current.details.overtime_minutes)} of these are overtime (standard
          hours: {formatMinutesLong(current.details.standard_minutes)} per{' '}
          {periodName(current.details)}).
        </p>
      ) : null}
    </ConfirmDialog>
  );

  return { run, dialog };
}
