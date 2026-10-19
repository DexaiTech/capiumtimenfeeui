import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

import { ErrorState, SegmentedControl, Skeleton } from '@/components/ui';
import { isApiError } from '@/services/api';

import type { EmailTemplatePreview } from '../../types';

type View = 'html' | 'text';

export interface TemplatePreviewProps {
  preview: UseQueryResult<EmailTemplatePreview>;
  /** True while the draft on screen is ahead of the one being rendered. */
  updating: boolean;
}

/**
 * The email as it would be sent (`POST …/preview`): the subject, and the message in a sandboxed
 * frame (no scripts, forms or navigation) or as plain text. A draft the API refuses has its
 * problems shown on the fields; here the preview waits for them to be fixed.
 */
export function TemplatePreview({ preview, updating }: TemplatePreviewProps) {
  const [view, setView] = useState<View>('html');

  let body;
  if (preview.isPending) {
    body = (
      <div role="status" aria-label="Loading the preview" className="flex flex-col gap-3">
        <Skeleton shape="rect" className="h-5 w-2/3" />
        <Skeleton shape="rect" className="h-64 w-full" />
      </div>
    );
  } else if (preview.isError) {
    const refused = isApiError(preview.error) && preview.error.status === 422;
    body = refused ? (
      <p
        role="status"
        className="rounded-md bg-surface-sunken px-4 py-6 text-center text-sm text-text-muted"
      >
        The preview appears when the problems marked on the fields are fixed.
      </p>
    ) : (
      <ErrorState
        title="Could not render the preview"
        error={isApiError(preview.error) ? preview.error : null}
        onRetry={() => void preview.refetch()}
        retrying={preview.isRefetching}
        className="py-6"
      />
    );
  } else {
    body = (
      <>
        <p className="text-sm text-text">
          <span className="text-text-muted">Subject: </span>
          <span className="font-semibold">{preview.data.subject}</span>
        </p>
        {view === 'html' ? (
          <iframe
            title="Email preview"
            // No permissions at all: the HTML is only drawn, never run.
            sandbox=""
            srcDoc={preview.data.html}
            className="h-96 w-full rounded-md border border-border bg-white"
          />
        ) : (
          <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface-sunken p-3 text-xs whitespace-pre-wrap text-text">
            {preview.data.text}
          </pre>
        )}
      </>
    );
  }

  return (
    <section aria-label="Preview" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">Preview</h3>
        <SegmentedControl
          label="Preview format"
          value={view}
          onChange={setView}
          options={[
            { value: 'html', label: 'Email' },
            { value: 'text', label: 'Plain text' },
          ]}
        />
      </div>
      <p className="text-xs text-text-muted" aria-live="polite">
        {updating ? 'Updating the preview…' : 'Shown with sample values, as it would be sent.'}
      </p>
      {body}
    </section>
  );
}
