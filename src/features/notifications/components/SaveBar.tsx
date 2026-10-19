import type { ReactNode } from 'react';

import { Button } from '@/components/ui';

export interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  saveLabel: string;
  onDiscard: () => void;
  /** An extra action on the left (for example "Reset to default"). */
  leading?: ReactNode;
}

/** The footer of an editable card: says there are unsaved changes, and offers Discard and Save. */
export function SaveBar({ dirty, saving, saveLabel, onDiscard, leading }: SaveBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-row-border px-5 py-3">
      {leading}
      {dirty ? (
        <p role="status" className="text-xs text-text-muted">
          You have unsaved changes.
        </p>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" disabled={!dirty || saving} onClick={onDiscard}>
          Discard changes
        </Button>
        <Button type="submit" variant="primary" disabled={!dirty} loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
