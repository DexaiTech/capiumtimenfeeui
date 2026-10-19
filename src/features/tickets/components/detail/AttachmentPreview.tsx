import { Download } from 'lucide-react';

import { Button, Modal, Spinner } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useAttachmentFile, useObjectUrl } from '../../hooks/useAttachmentFile';
import type { TicketAttachment } from '../../types';
import { formatFileSize } from '../../utils/format';

export interface AttachmentPreviewProps {
  ticketId: string;
  attachment: TicketAttachment;
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
}

function Picture({ ticketId, attachment }: { ticketId: string; attachment: TicketAttachment }) {
  const file = useAttachmentFile(ticketId, attachment.id);
  const url = useObjectUrl(file.data);
  if (file.isError) {
    return (
      <p role="alert" className="py-10 text-center text-sm text-text-muted">
        {isApiError(file.error) ? file.error.message : 'The image could not be loaded.'}
      </p>
    );
  }
  if (!url) {
    return (
      <div role="status" aria-label="Loading the image" className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={attachment.file_name}
      className="mx-auto max-h-[70dvh] max-w-full rounded-md object-contain"
    />
  );
}

/** The full image of an attachment in a dialog (the thumbnail's bytes, already cached). */
export function AttachmentPreview({
  ticketId,
  attachment,
  open,
  onClose,
  onDownload,
}: AttachmentPreviewProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={attachment.file_name}
      description={formatFileSize(attachment.size_bytes)}
      size="lg"
      footer={
        <>
          <Button
            onClick={onDownload}
            leftIcon={<Download aria-hidden="true" className="size-4" />}
          >
            Download
          </Button>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {open ? <Picture ticketId={ticketId} attachment={attachment} /> : null}
    </Modal>
  );
}
