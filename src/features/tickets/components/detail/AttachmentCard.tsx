import { X } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog, useToast } from '@/components/ui';
import { cn } from '@/utils/cn';

import { useDeleteAttachment } from '../../api';
import {
  useAttachmentFile,
  useDownloadAttachment,
  useObjectUrl,
} from '../../hooks/useAttachmentFile';
import type { TicketAttachment } from '../../types';
import { dialogError } from '../../utils/errors';
import { formatFileSize } from '../../utils/format';
import { AttachmentPreview } from './AttachmentPreview';
import { KindIcon } from './KindIcon';

export interface AttachmentCardProps {
  ticketId: string;
  attachment: TicketAttachment;
  /** The uploader with `ticket.update`, or anyone with `ticket.delete`. */
  canDelete: boolean;
  /** `sm` for the files inside a comment. */
  size?: 'sm' | 'md';
}

/**
 * A small card for one file: a thumbnail for an image (fetched with the Bearer token and shown
 * from a blob URL), else the icon of its kind; the truncated name and the size. A click previews
 * an image or downloads anything else; the × deletes, after a confirmation.
 */
export function AttachmentCard({
  ticketId,
  attachment,
  canDelete,
  size = 'md',
}: AttachmentCardProps) {
  const { toast } = useToast();
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const file = useAttachmentFile(ticketId, attachment.id, attachment.is_image);
  const thumbnail = useObjectUrl(file.data);
  const { download } = useDownloadAttachment(ticketId);
  const remove = useDeleteAttachment(ticketId);

  const open = () => {
    if (attachment.is_image) setPreviewing(true);
    else void download(attachment);
  };

  const confirmDelete = () => {
    remove.mutate(attachment.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${attachment.file_name} deleted` });
        setConfirming(false);
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  return (
    <>
      <div className="group relative rounded-lg border border-border bg-surface p-2 transition-colors duration-fast ease-standard hover:border-border-strong">
        <button
          type="button"
          onClick={open}
          aria-label={
            attachment.is_image
              ? `Preview ${attachment.file_name}`
              : `Download ${attachment.file_name}`
          }
          className="flex w-full min-w-0 flex-col gap-2 rounded-md text-left"
        >
          <span
            className={cn(
              'flex w-full items-center justify-center overflow-hidden rounded-md bg-surface-sunken',
              size === 'sm' ? 'h-16' : 'h-24',
            )}
          >
            {thumbnail ? (
              <img src={thumbnail} alt="" className="size-full object-cover" />
            ) : (
              <KindIcon
                fileName={attachment.file_name}
                contentType={attachment.content_type}
                className={size === 'sm' ? 'size-6' : 'size-8'}
              />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-text" title={attachment.file_name}>
              {attachment.file_name}
            </span>
            <span className="text-2xs text-text-muted tabular-nums">
              {formatFileSize(attachment.size_bytes)}
            </span>
          </span>
        </button>
        {canDelete ? (
          <button
            type="button"
            aria-label={`Delete ${attachment.file_name}`}
            onClick={() => {
              setRefusal(null);
              setConfirming(true);
            }}
            className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-surface/90 text-text-muted shadow-sm hover:bg-surface-hover hover:text-danger focus-visible:bg-surface-hover"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
      {attachment.is_image ? (
        <AttachmentPreview
          ticketId={ticketId}
          attachment={attachment}
          open={previewing}
          onClose={() => setPreviewing(false)}
          onDownload={() => void download(attachment)}
        />
      ) : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmDelete}
        title="Delete file?"
        confirmLabel="Delete file"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{attachment.file_name}</strong> will be removed
          from the ticket. This cannot be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
