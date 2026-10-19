import { FileSpreadsheet, FileText, Image, Table, type LucideIcon } from 'lucide-react';

import { formatFileSize } from './format';

/** The largest file the API takes (2 MB, inclusive). */
export const MAX_FILE_BYTES = 2_097_152;
export const MAX_FILE_LABEL = '2 MB';

export type FileKindKey = 'image' | 'pdf' | 'doc' | 'xls' | 'csv';

export interface FileKind {
  key: FileKindKey;
  /** As the drop zone lists it ("DOC/DOCX"). */
  label: string;
  extensions: ReadonlyArray<string>;
  icon: LucideIcon;
  /** Text colour class of its icon (a token). */
  text: string;
}

/** The accepted types, in the order the drop zone lists them. */
export const FILE_KINDS: ReadonlyArray<FileKind> = [
  {
    key: 'image',
    label: 'Image',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
    icon: Image,
    text: 'text-badge-violet',
  },
  { key: 'pdf', label: 'PDF', extensions: ['pdf'], icon: FileText, text: 'text-badge-red' },
  {
    key: 'doc',
    label: 'DOC/DOCX',
    extensions: ['doc', 'docx'],
    icon: FileText,
    text: 'text-badge-blue',
  },
  {
    key: 'xls',
    label: 'XLS/XLSX',
    extensions: ['xls', 'xlsx'],
    icon: FileSpreadsheet,
    text: 'text-badge-green',
  },
  { key: 'csv', label: 'CSV', extensions: ['csv'], icon: Table, text: 'text-badge-orange' },
];

/** The `accept` attribute of a file input. */
export const ACCEPT_ATTRIBUTE = FILE_KINDS.flatMap((kind) => kind.extensions)
  .map((extension) => `.${extension}`)
  .join(',');

/** The lower-case extension of a file name, without the dot ("" when there is none). */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

/** The kind of a file, by its extension; null for a type the API does not take. */
export function kindOfName(name: string): FileKind | null {
  const extension = extensionOf(name);
  return FILE_KINDS.find((kind) => kind.extensions.includes(extension)) ?? null;
}

/** The kind of a stored attachment: its detected content type first, its extension second. */
export function kindOfAttachment(fileName: string, contentType: string): FileKind | null {
  if (contentType.startsWith('image/')) return FILE_KINDS[0] ?? null;
  return kindOfName(fileName);
}

/**
 * A reason to refuse a file before uploading it (too big, empty, or not an accepted type), or
 * null. The API checks the content again and answers 413 or 422 with its own message.
 */
export function refusalFor(file: Pick<File, 'name' | 'size'>): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is larger than ${MAX_FILE_LABEL} (${formatFileSize(file.size)}).`;
  }
  if (!kindOfName(file.name)) {
    return `${file.name} is not an accepted type. Use an image, PDF, Word, Excel or CSV file.`;
  }
  return null;
}

/**
 * The files of a clipboard or drop event. A paste that carries text as well as files (a copied
 * spreadsheet range) is a text paste: the picture of it is not wanted.
 */
export function filesOf(data: DataTransfer | null, options: { ignoreWithText?: boolean } = {}) {
  if (!data || data.files.length === 0) return [];
  if (options.ignoreWithText && data.getData('text/plain')) return [];
  return Array.from(data.files);
}
