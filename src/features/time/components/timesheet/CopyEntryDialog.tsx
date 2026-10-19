import { useId, useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, Checkbox, DateField, Modal, useToast } from '@/components/ui';
import { addDays, formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { useCopyEntry } from '../../api';
import type { TimeEntry } from '../../types';
import { dialogError } from '../../utils/errors';
import { DialogActions } from '../DialogActions';

export interface CopyEntryDialogProps {
  open: boolean;
  onClose: () => void;
  entry: TimeEntry | null;
}

function CopyEntryForm({ entry, onClose }: { entry: TimeEntry; onClose: () => void }) {
  const copy = useCopyEntry();
  const { toast } = useToast();
  const formId = useId();
  const [date, setDate] = useState<string | null>(addDays(entry.entry_date, 1));
  const [includeNotes, setIncludeNotes] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [dateError, setDateError] = useState<string | undefined>();

  const submit = () => {
    setError(null);
    if (!date) {
      setDateError('Choose the day to copy the time to.');
      return;
    }
    setDateError(undefined);
    copy.mutate(
      { entryId: entry.id, body: { date, ...(includeNotes ? { include_notes: true } : {}) } },
      {
        onSuccess: (created) => {
          toast({
            tone: 'success',
            title: 'Time copied',
            description: `${formatMinutes(created.minutes)} was added on ${formatUkDate(created.entry_date)}.`,
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
          {formatMinutes(entry.minutes)} on {formatUkDate(entry.entry_date)}
          {entry.client_name ? ` for ${entry.client_name}` : ''} becomes a new entry. It follows the
          same rules as any new time: a closed job, a locked period or a full day refuse it.
        </p>
        <DateField label="Copy to" value={date} onChange={setDate} error={dateError} />
        <Checkbox
          label="Copy the internal note too"
          checked={includeNotes}
          onChange={(event) => setIncludeNotes(event.target.checked)}
        />
        {error ? <FormAlert message={error.message} requestId={error.requestId} /> : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={copy.isPending}>
          Copy time
        </Button>
      </DialogActions>
    </>
  );
}

/** Copies one entry to another day (the same day too). */
export function CopyEntryDialog({ open, onClose, entry }: CopyEntryDialogProps) {
  return (
    <Modal
      open={open && entry !== null}
      onClose={onClose}
      title="Copy to another day"
      size="sm"
      closeOnBackdrop={false}
    >
      {open && entry ? <CopyEntryForm key={entry.id} entry={entry} onClose={onClose} /> : null}
    </Modal>
  );
}
