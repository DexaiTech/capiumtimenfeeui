import { useState } from 'react';

import { ConfirmDialog, Textarea } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { useApplyRerate } from '../../api';
import type { ReratePreview, Rerun } from '../../types';
import { dialogError } from '../../utils/errors';
import { plural } from '../../utils/format';
import { formatDelta, isStalePreview, staleMessage } from '../../utils/rerate';

const NOTE_MAX = 500;

export interface ApplyDialogProps {
  /** The preview being applied; null while the dialog is closed. */
  preview: ReratePreview | null;
  /** `stale`: the API refused the preview as out of date, so it must be made again. */
  onClose: (stale: boolean) => void;
  onApplied: (run: Rerun, preview: ReratePreview) => void;
}

function ApplyBody({
  preview,
  onClose,
  onApplied,
}: {
  preview: ReratePreview;
  onClose: (stale: boolean) => void;
  onApplied: (run: Rerun, preview: ReratePreview) => void;
}) {
  const apply = useApplyRerate();
  const [note, setNote] = useState('');
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const [stale, setStale] = useState(false);
  const { totals } = preview;

  const confirm = () => {
    setRefusal(null);
    apply.mutate(
      {
        // The same scope the preview was made from, with the token that vouches for its result.
        scope: preview.scope,
        preview_token: preview.preview_token,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (run) => onApplied(run, preview),
        onError: (error) => {
          if (isStalePreview(error)) {
            setStale(true);
            setRefusal({ message: staleMessage(error) });
          } else {
            setRefusal(dialogError(error));
          }
        },
      },
    );
  };

  return (
    <ConfirmDialog
      open
      onClose={() => onClose(stale)}
      onConfirm={confirm}
      title="Apply the re-rate?"
      confirmLabel="Apply re-rate"
      tone="default"
      loading={apply.isPending}
      confirmDisabled={stale}
      error={refusal}
    >
      <p>
        <strong className="font-medium text-text">
          {plural(totals.entries_to_change, 'unbilled entry', 'unbilled entries')}
        </strong>{' '}
        will be re-priced. The charge-out value goes from {formatMoney(totals.charge_value_before)}{' '}
        to {formatMoney(totals.charge_value_after)} ({formatDelta(totals.charge_value_delta)}).
      </p>
      <p>
        Billed, drafted and written-off time is left alone. The change is recorded in the audit log
        and kept in the history of re-rates.
      </p>
      <Textarea
        label="Note (optional)"
        rows={2}
        maxLength={NOTE_MAX}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        hint="Why it was done, for the history."
      />
    </ConfirmDialog>
  );
}

/**
 * Step 3 of a re-rate: asks for confirmation (and an optional note) and applies the previewed
 * result. It stays open when the API refuses, and says so when the preview has gone stale.
 */
export function ApplyDialog({ preview, onClose, onApplied }: ApplyDialogProps) {
  if (!preview) return null;
  return (
    <ApplyBody
      key={preview.preview_token}
      preview={preview}
      onClose={onClose}
      onApplied={onApplied}
    />
  );
}
