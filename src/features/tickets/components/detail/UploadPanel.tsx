import { CloudUpload, Paperclip } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

import { Card } from '@/components/ui';
import { cn } from '@/utils/cn';

import { useUploads } from '../../hooks/useUploads';
import { usePasteFiles } from '../../hooks/usePasteFiles';
import { ACCEPT_ATTRIBUTE, FILE_KINDS, filesOf, MAX_FILE_LABEL } from '../../utils/files';
import { UploadRow } from './UploadRow';

export interface UploadPanelProps {
  ticketId: string;
  /** `ticket.update`: without it the panel only explains. */
  canUpdate: boolean;
}

const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

/**
 * "Attachment": a dashed drop zone. A file chosen, dropped or pasted (Ctrl+V) is checked on the
 * client (2 MB, accepted types) and uploaded to the ticket with its own progress and result;
 * the API's refusal (413, 422) shows with its message. The accepted types are listed under it.
 */
export function UploadPanel({ ticketId, canUpdate }: UploadPanelProps) {
  const uploads = useUploads(ticketId, { dismissWhenDone: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  usePasteFiles(uploads.add, canUpdate);

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    uploads.add(Array.from(event.target.files ?? []));
    // The same file can be chosen again.
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    uploads.add(filesOf(event.dataTransfer));
  };

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-row-border bg-surface-sunken px-5 py-3">
        <Paperclip aria-hidden="true" className="size-4 text-text-muted" />
        <h2 className="text-sm font-bold text-text">Attachment</h2>
      </header>
      <div className="flex flex-col gap-4 p-5">
        {canUpdate ? (
          <>
            <div
              onDragEnter={(event) => {
                if (carriesFiles(event)) setDragging(true);
              }}
              onDragOver={(event) => {
                if (!carriesFiles(event)) return;
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-fast ease-standard',
                dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-sunken',
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-text"
              >
                <CloudUpload className="size-6" />
              </span>
              <p className="text-sm text-text-muted">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-sm font-semibold text-brand-text hover:underline"
                >
                  Choose a file
                </button>
                , drag it here or paste it (Ctrl+V) to attach it to this ticket.
              </p>
              <p className="text-xs text-text-subtle">Max file size: {MAX_FILE_LABEL}</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                accept={ACCEPT_ATTRIBUTE}
                onChange={onChoose}
              />
            </div>
            <ul
              aria-label="Accepted file types"
              className="flex flex-wrap justify-center gap-x-5 gap-y-2"
            >
              {FILE_KINDS.map((kind) => {
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
                  <UploadRow
                    key={item.id}
                    item={item}
                    onRemove={(entry) => uploads.dismiss(entry.id)}
                  />
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-text-muted">
            Your role can open the files of this ticket but not add new ones.
          </p>
        )}
      </div>
    </Card>
  );
}
