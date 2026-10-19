import type { BaseSyntheticEvent, ReactNode } from 'react';

import { FormAlert, type SubmitError } from '@/components/forms';
import { Button, Card } from '@/components/ui';

import { useBeforeUnload } from '../../hooks/useBeforeUnload';

export interface SettingsCardProps {
  title: string;
  description: ReactNode;
  saveLabel: string;
  /** False shows every value with the controls disabled and no footer. */
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  retryIn: number;
  submitError: SubmitError | null;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<unknown>;
  onDiscard: () => void;
  children: ReactNode;
}

/**
 * One card of the General Settings page: its own form with its own Save, so a setting is saved
 * where it is read. While the card has unsaved changes the browser asks before the tab closes.
 */
export function SettingsCard({
  title,
  description,
  saveLabel,
  editable,
  dirty,
  saving,
  retryIn,
  submitError,
  onSubmit,
  onDiscard,
  children,
}: SettingsCardProps) {
  useBeforeUnload(dirty);
  return (
    <form noValidate aria-label={title} onSubmit={(event) => void onSubmit(event)}>
      <Card padding="none">
        <div className="flex flex-col gap-1 px-5 pt-5">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="text-sm text-text-muted">{description}</p>
        </div>
        <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-5 px-5 py-5">
          {children}
        </fieldset>
        {submitError ? (
          <div className="px-5 pb-4">
            <FormAlert message={submitError.message} requestId={submitError.requestId} />
          </div>
        ) : null}
        {editable ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-row-border px-5 py-3">
            {dirty ? (
              <p role="status" className="text-xs text-text-muted">
                You have unsaved changes.
              </p>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button disabled={!dirty || saving} onClick={onDiscard}>
                Discard changes
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={!dirty || retryIn > 0}
              >
                {saveLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </form>
  );
}
