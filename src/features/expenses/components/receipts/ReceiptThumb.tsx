import { FileImage, FileText } from 'lucide-react';

import { cn } from '@/utils/cn';

import { useReceiptFile } from '../../api';
import { useObjectUrl } from '../../hooks/useReceiptFile';
import type { Receipt } from '../../types';

export interface ReceiptThumbProps {
  lineId: string;
  receipt: Pick<Receipt, 'id' | 'is_image' | 'file_name'>;
  className?: string;
}

/**
 * A small picture of a receipt: the image itself (fetched with the token and shown from a blob
 * URL, once) or the icon of its kind when it is a PDF or the picture cannot be loaded.
 */
export function ReceiptThumb({ lineId, receipt, className }: ReceiptThumbProps) {
  const file = useReceiptFile(lineId, receipt.id, receipt.is_image);
  const url = useObjectUrl(file.data);
  const box = cn(
    'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-sunken',
    className,
  );
  if (receipt.is_image && url) {
    return (
      <span className={box}>
        <img src={url} alt="" className="size-full object-cover" />
      </span>
    );
  }
  const Icon = receipt.is_image ? FileImage : FileText;
  return (
    <span aria-hidden="true" className={box}>
      <Icon className={cn('size-5', receipt.is_image ? 'text-badge-violet' : 'text-badge-red')} />
    </span>
  );
}
