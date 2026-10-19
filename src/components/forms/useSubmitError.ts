import { useCallback, useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { useToast } from '@/components/ui';
import { useCountdown } from '@/hooks';
import { isApiError, type ApiError } from '@/services/api';
import type { FieldErrorDetail } from '@/types/api';
import { formatWait } from '@/utils/format';

export interface SubmitError {
  message: string;
  requestId?: string;
  /** The API error code, so a form can offer a follow-up (for example resend verification). */
  code?: string;
}

function isFieldErrorList(details: unknown): details is FieldErrorDetail[] {
  return (
    Array.isArray(details) &&
    details.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as FieldErrorDetail).field === 'string' &&
        typeof (entry as FieldErrorDetail).message === 'string',
    )
  );
}

/**
 * Maps the entries of a 422 `error.details` onto form fields and focuses the first one.
 * Returns the messages that matched no field, to be shown as a form-level error.
 */
export function applyFieldErrors<TValues extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<TValues>,
  fields: ReadonlyArray<Path<TValues>>,
): string[] {
  if (!isFieldErrorList(error.details)) return [error.message];
  const known = new Set<string>(fields);
  const unmatched: string[] = [];
  let focused = false;
  for (const detail of error.details) {
    if (known.has(detail.field)) {
      setError(
        detail.field as Path<TValues>,
        { type: 'server', message: detail.message },
        { shouldFocus: !focused },
      );
      focused = true;
    } else {
      unmatched.push(detail.message);
    }
  }
  return unmatched;
}

export interface UseSubmitErrorOptions<TValues extends FieldValues> {
  setError: UseFormSetError<TValues>;
  /** The field paths this form owns; 422 details for other paths become a form-level error. */
  fields: ReadonlyArray<Path<TValues>>;
}

export interface UseSubmitErrorResult {
  /** Form-level error to render above the submit button. */
  submitError: SubmitError | null;
  /** Seconds until a rate-limited form may be submitted again; 0 when not limited. */
  retryIn: number;
  handleSubmitError: (error: unknown) => void;
  clearSubmitError: () => void;
}

/**
 * The uniform per-status handling for form submissions (docs/error-handling.md):
 * 422 → field errors, 429 → wait message with the submit disabled, network and 5xx → toast
 * plus an inline message, everything else → the server's message inline. Values are never cleared.
 */
export function useSubmitError<TValues extends FieldValues>({
  setError,
  fields,
}: UseSubmitErrorOptions<TValues>): UseSubmitErrorResult {
  const { toast } = useToast();
  const { secondsLeft, start } = useCountdown();
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);

  const handleSubmitError = useCallback(
    (error: unknown) => {
      if (!isApiError(error)) {
        const message = 'An unexpected error occurred. Please try again.';
        setSubmitError({ message });
        toast({ tone: 'error', title: 'Something went wrong', description: message });
        return;
      }

      if (error.status === 422 && isFieldErrorList(error.details)) {
        const unmatched = applyFieldErrors(error, setError, fields);
        setSubmitError(
          unmatched.length > 0 ? { message: unmatched.join(' '), code: error.code } : null,
        );
        return;
      }

      if (error.status === 429) {
        const seconds = error.retryAfter ?? 60;
        start(seconds);
        setSubmitError(null);
        toast({
          tone: 'warning',
          title: 'Too many attempts',
          description: `Try again in ${formatWait(seconds)}.`,
        });
        return;
      }

      if (error.retryable) {
        toast({
          tone: 'error',
          title: error.status === 0 ? 'Could not reach the server' : 'Something went wrong',
          description: error.requestId
            ? `${error.message} (Request ID: ${error.requestId})`
            : error.message,
        });
      }
      setSubmitError({ message: error.message, requestId: error.requestId, code: error.code });
    },
    [fields, setError, start, toast],
  );

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  return {
    submitError:
      secondsLeft > 0
        ? {
            message: `Too many attempts. Try again in ${formatWait(secondsLeft)}.`,
            code: 'RATE_LIMITED',
          }
        : submitError,
    retryIn: secondsLeft,
    handleSubmitError,
    clearSubmitError,
  };
}
