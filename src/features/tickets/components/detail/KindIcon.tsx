import { File } from 'lucide-react';

import { cn } from '@/utils/cn';

import { kindOfAttachment } from '../../utils/files';

export interface KindIconProps {
  fileName: string;
  contentType: string;
  className?: string;
}

/** The icon of a file's kind (image, PDF, Word, Excel, CSV) in the kind's colour. */
export function KindIcon({ fileName, contentType, className }: KindIconProps) {
  const kind = kindOfAttachment(fileName, contentType);
  const Icon = kind?.icon ?? File;
  return <Icon aria-hidden="true" className={cn(kind?.text ?? 'text-text-muted', className)} />;
}
