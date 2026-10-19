import { X } from 'lucide-react';

import { ProgressBar } from '@/components/ui';
import { cn } from '@/utils/cn';

import type { UploadItem } from '../../hooks/useUploads';
import { formatFileSize } from '../../utils/format';
import { KindIcon } from './KindIcon';

export interface UploadRowProps {
  item: UploadItem;
  /** Takes the row off the list (cancels a running upload). */
  onRemove: (item: UploadItem) => void;
  /** What a finished upload says. */
  doneText?: string;
}

/** One file being uploaded: its name, the progress, the stored file or the reason it failed. */
export function UploadRow({ item, onRemove, doneText = 'Uploaded' }: UploadRowProps) {
  const failed = item.status === 'failed';
  const percent = Math.round(item.progress * 100);
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 text-xs',
        failed ? 'border-danger/40' : 'border-border',
      )}
    >
      <KindIcon fileName={item.name} contentType="" className="size-4 shrink-0" />
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
        ) : failed ? (
          <span role="alert" className="text-danger">
            {item.error}
          </span>
        ) : (
          <span className="text-text-muted">
            {doneText} · {formatFileSize(item.size)}
          </span>
        )}
      </div>
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
