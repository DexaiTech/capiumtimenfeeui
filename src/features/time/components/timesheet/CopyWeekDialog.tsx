import { useId, useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, Checkbox, Modal, Skeleton, useToast } from '@/components/ui';
import { addDays, formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useCopyWeek, useRangeEntries } from '../../api';
import type { CopyWeekResult, TimeEntry } from '../../types';
import { dialogError } from '../../utils/errors';
import { refLabel } from '../../utils/format';
import { DialogActions } from '../DialogActions';

/** Why a copy was left out (`skipped[].code`): the code the same entry would get by hand. */
const SKIP_REASON: Record<string, string> = {
  JOB_CLOSED: 'The job is closed',
  CLIENT_INACTIVE: 'The client is inactive',
  DAY_LIMIT_EXCEEDED: 'More than 24 hours in the day',
  PERIOD_LOCKED: 'The period is locked',
  ACTIVITY_NOT_ALLOWED: "The activity is not allowed for the job's service",
  AFTER_LEAVING_DATE: 'After the leaving date',
  TIME_LOCKED: 'The timesheet is locked',
  RESOURCE_NOT_FOUND: 'It no longer exists',
  VALIDATION_ERROR: 'It is not valid',
};

export interface CopyWeekDialogProps {
  open: boolean;
  onClose: () => void;
  /** Any day of the week to copy from. */
  fromWeekStart: string;
  /** Any day of the week to copy into. */
  toWeekStart: string;
}

function entryLabel(entry: TimeEntry | undefined): string {
  if (!entry) return 'An entry';
  const what = [
    entry.client_name,
    refLabel({ code: entry.job_number, name: entry.job_name }) || null,
    entry.activity_name,
  ]
    .filter(Boolean)
    .join(' · ');
  return `${what || 'Time'} on ${formatUkDate(entry.entry_date)}, ${formatMinutes(entry.minutes)}`;
}

function SkippedReport({
  result,
  source,
  onClose,
}: {
  result: CopyWeekResult;
  source: ReadonlyMap<string, TimeEntry>;
  onClose: () => void;
}) {
  const created = result.created.length;
  return (
    <>
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-text">
          {created} {created === 1 ? 'entry was' : 'entries were'} copied into the week of{' '}
          {formatUkDate(result.to_week_start)}. {result.skipped.length}{' '}
          {result.skipped.length === 1 ? 'was' : 'were'} left out:
        </p>
        <table className="w-full text-xs">
          <caption className="sr-only">Entries that were not copied</caption>
          <thead>
            <tr className="text-left text-text-muted">
              <th scope="col" className="pr-3 pb-1 font-medium">
                Entry
              </th>
              <th scope="col" className="pb-1 font-medium">
                Why
              </th>
            </tr>
          </thead>
          <tbody>
            {result.skipped.map((item) => (
              <tr key={item.source_entry_id} className="border-t border-row-border align-top">
                <td className="py-1.5 pr-3 text-text">
                  {entryLabel(source.get(item.source_entry_id))}
                </td>
                <td className="py-1.5 text-text-muted">
                  <span className="font-medium text-text">
                    {SKIP_REASON[item.code] ?? item.code}.
                  </span>{' '}
                  {item.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DialogActions>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </>
  );
}

function CopyWeekForm({ fromWeekStart, toWeekStart, onClose }: Omit<CopyWeekDialogProps, 'open'>) {
  const copy = useCopyWeek();
  const { toast } = useToast();
  const formId = useId();
  const [includeNotes, setIncludeNotes] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [result, setResult] = useState<CopyWeekResult | null>(null);

  const source = useRangeEntries('me', fromWeekStart, addDays(fromWeekStart, 6));
  const entries = source.data ?? [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  if (result) return <SkippedReport result={result} source={byId} onClose={onClose} />;

  const submit = () => {
    setError(null);
    copy.mutate(
      {
        from_week_start: fromWeekStart,
        to_week_start: toWeekStart,
        ...(includeNotes ? { include_notes: true } : {}),
      },
      {
        onSuccess: (done) => {
          if (done.skipped.length > 0) {
            setResult(done);
            return;
          }
          toast({
            tone: 'success',
            title: 'Time copied',
            description: `${done.created.length} ${done.created.length === 1 ? 'entry was' : 'entries were'} copied.`,
          });
          onClose();
        },
        onError: (failure) => setError(dialogError(failure)),
      },
    );
  };

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-text-muted">
          Every entry of the week of {formatUkDate(fromWeekStart)} is copied to the same day of the
          week of {formatUkDate(toWeekStart)}. Each copy follows the rules of new time, so some may
          be left out (a closed job, a locked period); you will see which.
        </p>
        {source.isPending ? (
          <Skeleton className="h-4 w-48" shape="rect" />
        ) : source.isError ? (
          <FormAlert message="The entries of that week could not be loaded." />
        ) : (
          <p role="status" className="text-sm font-medium text-text">
            {entries.length === 0
              ? 'There is no time in that week to copy.'
              : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} to copy.`}
          </p>
        )}
        <Checkbox
          label="Copy the internal notes too"
          checked={includeNotes}
          onChange={(event) => setIncludeNotes(event.target.checked)}
        />
        {error ? <FormAlert message={error.message} requestId={error.requestId} /> : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={copy.isPending}
          disabled={entries.length === 0}
        >
          Copy time
        </Button>
      </DialogActions>
    </>
  );
}

/** Copies last week's time into this week and reports what could not be copied. */
export function CopyWeekDialog({ open, onClose, fromWeekStart, toWeekStart }: CopyWeekDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Copy the previous week" closeOnBackdrop={false}>
      {open ? (
        <CopyWeekForm
          key={`${fromWeekStart}-${toWeekStart}`}
          fromWeekStart={fromWeekStart}
          toWeekStart={toWeekStart}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
