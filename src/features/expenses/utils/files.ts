import { FileImage, FileText, type LucideIcon } from 'lucide-react';

import { MAX_RECEIPT_BYTES, MAX_RECEIPT_LABEL } from '../constants';
import { formatFileSize } from './format';

export interface ReceiptKind {
  key: 'image' | 'pdf';
  /** As the drop zone lists it. */
  label: string;
  extensions: ReadonlyArray<string>;
  icon: LucideIcon;
  /** Text colour class of its icon (a token). */
  text: string;
}

/** The accepted types, as the API takes them (`docs/modules/expenses.md`, "What is accepted"). */
export const RECEIPT_KINDS: ReadonlyArray<ReceiptKind> = [
  {
    key: 'image',
    label: 'JPG or PNG image',
    extensions: ['jpg', 'jpeg', 'png'],
    icon: FileImage,
    text: 'text-badge-violet',
  },
  { key: 'pdf', label: 'PDF', extensions: ['pdf'], icon: FileText, text: 'text-badge-red' },
];

/** The `accept` attribute of the file input. */
export const RECEIPT_ACCEPT = RECEIPT_KINDS.flatMap((kind) => kind.extensions)
  .map((extension) => `.${extension}`)
  .join(',');

/** The lower-case extension of a file name, without the dot ("" when there is none). */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

export function kindOfName(name: string): ReceiptKind | null {
  const extension = extensionOf(name);
  return RECEIPT_KINDS.find((kind) => kind.extensions.includes(extension)) ?? null;
}

/**
 * A reason to refuse a file before uploading it (empty, too big or not a PDF, JPG or PNG), or
 * null. The API checks the content again and answers 413 or 422 with its own message.
 */
export function refusalFor(file: Pick<File, 'name' | 'size'>): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_RECEIPT_BYTES) {
    return `${file.name} is larger than ${MAX_RECEIPT_LABEL} (${formatFileSize(file.size)}).`;
  }
  if (!kindOfName(file.name)) {
    return `${file.name} is not an accepted type. Use a PDF, JPG or PNG file.`;
  }
  return null;
}
