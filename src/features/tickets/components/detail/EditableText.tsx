import { Pencil, type LucideIcon } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';

import {
  Button,
  Input,
  plainTextToHtml,
  RichText,
  RichTextEditor,
  type RichTextValue,
} from '@/components/ui';
import { isApiError } from '@/services/api';

import { fieldDetails } from '../../utils/errors';

export interface EditableTextProps {
  /** "Subject" or "Description": the heading, and the name of the field in `error.details`. */
  label: string;
  icon: LucideIcon;
  value: string | null;
  /** Rich text: the sanitised HTML of `value`, null for a plain text written before formatting. */
  valueHtml?: string | null;
  multiline: boolean;
  /** Edit with the rich text box (bold, lists, links…); `onSave` gets the HTML as well. */
  rich?: boolean;
  /** `ticket.update`: the pencil is offered. */
  canEdit: boolean;
  /** Shown in the box while the text is empty. */
  emptyText: string;
  /** A message for text that cannot be saved, or null. */
  validate: (text: string) => string | null;
  /** Saves the new text; rejects with the API's error. */
  onSave: (text: string, html?: string) => Promise<void>;
}

/**
 * A text of the ticket shown in a read-only looking grey box. The pencil turns the box into an
 * input (a textarea for the description) with Save and Cancel: Enter saves (Ctrl+Enter in the
 * textarea, where Enter is a new line), Escape cancels. The API's refusal shows under the field.
 */
export function EditableText({
  label,
  icon: Icon,
  value,
  valueHtml,
  multiline,
  rich = false,
  canEdit,
  emptyText,
  validate,
  onSave,
}: EditableTextProps) {
  const headingId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  // The rich text box: its HTML and text, and the HTML it started with.
  const [richDraft, setRichDraft] = useState<RichTextValue>({ html: '', text: '' });
  const [startedWith, setStartedWith] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const start = () => {
    if (rich) {
      const html = valueHtml ?? plainTextToHtml(value ?? '');
      setStartedWith(html);
      setRichDraft({ html, text: value ?? '' });
    }
    setDraft(value ?? '');
    setError(undefined);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError(undefined);
  };

  const save = async () => {
    const next = (rich ? richDraft.text : draft).trim();
    // Nothing changed (for rich text the HTML is compared: formatting alone is an edit).
    if (rich ? richDraft.html === startedWith : next === (value ?? '').trim()) {
      cancel();
      return;
    }
    const problem = validate(next);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await onSave(next, rich ? richDraft.html : undefined);
      setEditing(false);
    } catch (failure) {
      const named = fieldDetails(failure).find((detail) => detail.field === label.toLowerCase());
      setError(
        named?.message ??
          (isApiError(failure) ? failure.message : 'Could not save. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      (!multiline || event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-bold text-text">
          <Icon aria-hidden="true" className="size-4 text-text-muted" />
          {label}
        </h2>
        {canEdit && !editing ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${label.toLowerCase()}`}
            onClick={start}
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          {rich ? (
            <RichTextEditor
              label={label}
              hideLabel
              ariaLabel={label}
              autoFocus
              value={richDraft.html}
              error={error}
              hint="Ctrl+Enter saves, Escape cancels."
              areaClassName="min-h-36"
              onChange={(next) => {
                setRichDraft(next);
                setError(undefined);
              }}
              onSubmitShortcut={() => void save()}
              onEscape={cancel}
            />
          ) : (
            <Input
              label={label}
              hideLabel
              autoFocus
              autoComplete="off"
              value={draft}
              error={error}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(undefined);
              }}
              onKeyDown={onKeyDown}
            />
          )}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
            <Button size="sm" disabled={saving} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-h-10 rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-sm break-words text-text">
          {value ? (
            <RichText html={valueHtml} text={value} />
          ) : (
            <span className="text-text-subtle">{emptyText}</span>
          )}
        </div>
      )}
    </section>
  );
}
