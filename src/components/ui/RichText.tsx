import { useMemo } from 'react';

import { cn } from '@/utils/cn';

import { richTextNodes } from './richTextNodes';

export interface RichTextProps {
  /** The sanitised HTML of the text; absent for text written before formatting existed. */
  html?: string | null;
  /** The plain text: shown, with its line breaks, when there is no HTML. */
  text: string;
  className?: string;
}

/** A formatted text (or a plain one) of a ticket or a comment. */
export function RichText({ html, text, className }: RichTextProps) {
  const nodes = useMemo(() => (html ? richTextNodes(html) : null), [html]);
  if (nodes === null) {
    return <p className={cn('break-words whitespace-pre-wrap', className)}>{text}</p>;
  }
  return <div className={cn('rich-text', className)}>{nodes}</div>;
}
