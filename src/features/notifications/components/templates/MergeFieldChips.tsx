import type { MergeField } from '../../types';
import { mergeToken } from '../../utils/draft';

export interface MergeFieldChipsProps {
  fields: ReadonlyArray<MergeField>;
  /** Fields that must appear in the HTML or the text body. */
  required: ReadonlyArray<string>;
  /** Inserts `{{ name }}` where the caret is. */
  onInsert: (name: string) => void;
  disabled?: boolean;
}

/** The merge fields of one template as buttons: only these can be used, each inserts `{{ name }}`. */
export function MergeFieldChips({ fields, required, onInsert, disabled }: MergeFieldChipsProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-row-border px-5 py-4">
      <p className="text-xs font-semibold text-text">Merge fields</p>
      <p className="text-xs text-text-muted">
        Choose one to put it where your cursor is. Only these fields can be used in this email; they
        are filled in when it is sent.
        {required.length > 0
          ? ` ${required.map(mergeToken).join(', ')} must appear in the HTML or the plain text.`
          : ''}
      </p>
      <div role="group" aria-label="Merge fields" className="flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <button
            key={field.name}
            type="button"
            disabled={disabled}
            title={`${field.label}: ${field.description} (for example “${field.sample}”)`}
            onClick={() => onInsert(field.name)}
            className="min-h-11 rounded-full border border-border bg-surface px-3 font-mono text-xs text-text-muted transition-colors duration-fast ease-standard hover:border-brand hover:bg-brand-soft hover:text-brand-text disabled:opacity-55 md:min-h-7"
          >
            {mergeToken(field.name)}
          </button>
        ))}
      </div>
    </div>
  );
}
