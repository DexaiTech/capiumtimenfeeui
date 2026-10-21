import { useEffect } from 'react';

import { filesOf } from '../utils/files';

/**
 * Files pasted anywhere on the page (Ctrl+V with an image or a file on the clipboard) go to
 * `onFiles`, unless the paste lands in a field: the comment box takes its own pastes, and text
 * fields keep their text.
 */
export function usePasteFiles(onFiles: (files: File[]) => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (event: ClipboardEvent) => {
      // A drop zone or the comment box that has the focus handled this paste itself.
      if (event.defaultPrevented) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const files = filesOf(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      onFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled, onFiles]);
}
