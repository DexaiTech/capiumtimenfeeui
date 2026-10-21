import { CloudUpload, X } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

import { ProgressBar } from '@/components/ui';
import { useFileIntake } from '@/hooks';
import { cn } from '@/utils/cn';

import { MAX_RECEIPT_LABEL, MAX_RECEIPTS_PER_LINE } from '../../constants';
import { useReceiptUploads, type UploadItem } from '../../hooks/useReceiptUploads';
import { RECEIPT_ACCEPT, RECEIPT_KINDS } from '../../utils/files';
import { formatFileSize } from '../../utils/format';

function UploadRow({ item, onRemove }: { item: UploadItem; onRemove: (item: UploadItem) => void }) {
  const failed = item.status === 'failed';
  const percent = Math.round(item.progress * 100);
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 text-xs',
        failed ? 'border-danger/40' : 'border-border',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-text" title={item.name}>
          {item.name}
        </span>
        {item.status === 'uploading' ? (
          <ProgressBar
            label={`Uploading ${item.name}`}
            hideLabel
            value={percent}
            valueText={`${String(percent)}%`}
          />
        ) : (
          <span role="alert" className="text-danger">
            {item.error}
          </span>
        )}
      </div>
      <span className="shrink-0 text-text-muted">{formatFileSize(item.size)}</span>
      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        onClick={() => onRemove(item)}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover hover:text-text"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </li>
  );
}

export interface UploadZoneProps {
  claimId: string;
  lineId: string;
  /** How many receipts the line holds already. */
  count: number;
}

/**
 * "Add a receipt": a dashed drop zone. A file chosen or dropped is checked on the client (PDF,
 * JPG or PNG, up to 10 MB) and uploaded with its own progress and result; the API's refusal
 * (413, 422, 409) shows with its message.
 */
export function UploadZone({ claimId, lineId, count }: UploadZoneProps) {
  const uploads = useReceiptUploads(claimId, lineId);
  const inputRef = useRef<HTMLInputElement>(null);
  const full = count >= MAX_RECEIPTS_PER_LINE;
  const { dragging, intakeProps } = useFileIntake({ onFiles: uploads.add, disabled: full });

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    uploads.add(Array.from(event.target.files ?? []));
    // The same file can be chosen again.
    event.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      {full ? (
        <p className="text-sm text-text-muted">
          This expense holds the most receipts it can ({String(MAX_RECEIPTS_PER_LINE)}). Delete one
          to add another.
        </p>
      ) : (
        <div
          {...intakeProps}
          aria-label="Receipt drop zone"
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center outline-none transition-colors duration-fast ease-standard',
            'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30',
            dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-sunken',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-text"
          >
            <CloudUpload className="size-5" />
          </span>
          <p className="text-sm text-text-muted">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-sm font-semibold text-brand-text hover:underline"
            >
              Choose a receipt
            </button>
            , drag it here, or click here and paste it (Ctrl+V).
          </p>
          <p className="text-xs text-text-subtle">
            Max file size: {MAX_RECEIPT_LABEL}. Up to {String(MAX_RECEIPTS_PER_LINE)} receipts per
            expense.
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            aria-label="Receipt files"
            accept={RECEIPT_ACCEPT}
            onChange={onChoose}
          />
        </div>
      )}
      <ul
        aria-label="Accepted file types"
        className="flex flex-wrap justify-center gap-x-5 gap-y-1"
      >
        {RECEIPT_KINDS.map((kind) => {
          const Icon = kind.icon;
          return (
            <li
              key={kind.key}
              className="flex items-center gap-1.5 text-xs font-medium text-text-muted"
            >
              <Icon aria-hidden="true" className={cn('size-4', kind.text)} />
              {kind.label}
            </li>
          );
        })}
      </ul>
      {uploads.items.length > 0 ? (
        <ul aria-label="Uploads" aria-live="polite" className="flex flex-col gap-1.5">
          {uploads.items.map((item) => (
            <UploadRow key={item.id} item={item} onRemove={(entry) => uploads.dismiss(entry.id)} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
