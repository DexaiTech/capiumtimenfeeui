import type { ReactNode } from 'react';

export interface FieldIds {
  inputId: string;
  hintId: string;
  errorId: string;
}

export function fieldIds(baseId: string): FieldIds {
  return { inputId: baseId, hintId: `${baseId}-hint`, errorId: `${baseId}-error` };
}

/** `aria-describedby` for a control: the error when present, plus the hint. */
export function describedBy(ids: FieldIds, hint?: ReactNode, error?: string): string | undefined {
  const value = [error ? ids.errorId : null, hint ? ids.hintId : null].filter(Boolean).join(' ');
  return value || undefined;
}

export const controlClasses =
  'w-full rounded-md border border-border bg-surface text-base text-text md:text-xs ' +
  'transition-[border-color,box-shadow] duration-fast ease-standard ' +
  'hover:border-border-strong focus-visible:border-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger';
