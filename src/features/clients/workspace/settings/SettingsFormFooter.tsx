import { Button } from '@/components/ui';
import { useBeforeUnload } from '@/features/settings';

export interface SettingsFormFooterProps {
  saveLabel: string;
  dirty: boolean;
  saving: boolean;
  /** Seconds before the API accepts another attempt (a rate limit); 0 when none. */
  retryIn: number;
  onDiscard: () => void;
}

/**
 * The foot of a form card, as on Settings → General: a note while there are unsaved changes,
 * Discard changes, and Save. It spans the card (the offsets cancel the body padding of
 * `SettingsCard`) and, while the form has unsaved changes, the browser asks before the tab closes.
 */
export function SettingsFormFooter({
  saveLabel,
  dirty,
  saving,
  retryIn,
  onDiscard,
}: SettingsFormFooterProps) {
  useBeforeUnload(dirty);
  return (
    <div className="-mx-5 -mb-5 mt-1 flex flex-wrap items-center gap-2 border-t border-row-border px-5 py-3">
      {dirty ? (
        <p role="status" className="text-xs text-text-muted">
          You have unsaved changes.
        </p>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button disabled={!dirty || saving} onClick={onDiscard}>
          Discard changes
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty || retryIn > 0}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
