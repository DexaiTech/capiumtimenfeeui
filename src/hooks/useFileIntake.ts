import { useRef, useState, type ClipboardEvent, type DragEvent, type HTMLAttributes } from 'react';

export interface FileIntakeOptions {
  /** Called with the files that were dropped on, or pasted into, the element. */
  onFiles: (files: File[]) => void;
  /** Ignores drops and pastes (a full list, a role that may not add files). */
  disabled?: boolean;
}

export interface FileIntake {
  /** True while a file is dragged over the element: highlight it. */
  dragging: boolean;
  /**
   * Spread on the drop zone. `tabIndex` makes it focusable, so a click (or Tab) puts the focus on
   * it and Ctrl+V then pastes a screenshot or a copied file into it.
   */
  intakeProps: Pick<
    HTMLAttributes<HTMLElement>,
    'onDragEnter' | 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onPaste' | 'tabIndex'
  >;
}

const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

/**
 * The files on a clipboard. A paste that carries text as well as files (a copied spreadsheet
 * range comes with a picture of it) is a text paste, so no file is taken from it.
 */
export function filesOfClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  if (data.getData('text/plain')) return [];
  if (data.files.length > 0) return Array.from(data.files);
  return Array.from(data.items ?? []).flatMap((item) => {
    const file = item.kind === 'file' ? item.getAsFile() : null;
    return file ? [file] : [];
  });
}

/**
 * Drag-and-drop and paste (Ctrl+V while the element has the focus) for one element, the same
 * way everywhere a file or a picture can be attached.
 */
export function useFileIntake({ onFiles, disabled = false }: FileIntakeOptions): FileIntake {
  const [dragging, setDragging] = useState(false);
  // dragenter and dragleave also fire for the children: only the last leave ends the highlight.
  const depth = useRef(0);

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    if (disabled || !carriesFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  };
  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (disabled || !carriesFiles(event)) return;
    // Without this the browser refuses the drop.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    depth.current = 0;
    setDragging(false);
    if (disabled || !carriesFiles(event)) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };
  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    if (disabled) return;
    const files = filesOfClipboard(event.clipboardData);
    if (files.length === 0) return;
    event.preventDefault();
    onFiles(files);
  };

  return {
    dragging,
    intakeProps: { onDragEnter, onDragOver, onDragLeave, onDrop, onPaste, tabIndex: 0 },
  };
}
