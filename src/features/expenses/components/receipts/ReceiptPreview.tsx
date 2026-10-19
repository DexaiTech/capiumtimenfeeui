import { Download, ExternalLink } from 'lucide-react';

import { Button, Modal, Spinner } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useReceiptFile } from '../../api';
import { useDownloadReceipt, useObjectUrl } from '../../hooks/useReceiptFile';
import type { Receipt } from '../../types';
import { formatFileSize } from '../../utils/format';

export interface ReceiptPreviewProps {
  lineId: string;
  receipt: Pick<Receipt, 'id' | 'file_name' | 'size_bytes' | 'is_image'>;
  open: boolean;
  onClose: () => void;
}

export interface ReceiptViewerProps {
  lineId: string;
  receipt: Pick<Receipt, 'id' | 'file_name' | 'is_image'>;
}

/** The receipt itself: the picture of an image, a link for a PDF. */
export function ReceiptViewer({ lineId, receipt }: ReceiptViewerProps) {
  const file = useReceiptFile(lineId, receipt.id);
  const url = useObjectUrl(file.data);
  if (file.isError) {
    return (
      <p role="alert" className="py-10 text-center text-sm text-text-muted">
        {isApiError(file.error) ? file.error.message : 'The receipt could not be loaded.'}
      </p>
    );
  }
  if (!url) {
    return (
      <div role="status" aria-label="Loading the receipt" className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (receipt.is_image) {
    return (
      <img
        src={url}
        alt={receipt.file_name}
        className="mx-auto max-h-[70dvh] max-w-full rounded-md object-contain"
      />
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-text-muted">
        A PDF cannot be shown here. Open it in a new tab or download it.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline"
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        Open {receipt.file_name} in a new tab
      </a>
    </div>
  );
}

/** A receipt in a dialog: the picture for an image, a link for a PDF, and a download. */
export function ReceiptPreview({ lineId, receipt, open, onClose }: ReceiptPreviewProps) {
  const { download, pending } = useDownloadReceipt();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={receipt.file_name}
      description={formatFileSize(receipt.size_bytes)}
      size="lg"
      footer={
        <>
          <Button
            loading={pending}
            onClick={() => void download(lineId, receipt)}
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
      {open ? <ReceiptViewer lineId={lineId} receipt={receipt} /> : null}
    </Modal>
  );
}
