import { ArrowLeft } from 'lucide-react';
import { useRef, useState, type SyntheticEvent } from 'react';

import { Badge, Button, Card, ConfirmDialog, Input, Textarea, useToast } from '@/components/ui';
import { useDebouncedValue } from '@/hooks';

import { useResetEmailTemplate, useSaveEmailTemplate, useTemplatePreview } from '../../api/hooks';
import { PREVIEW_DELAY_MS } from '../../constants';
import type { EmailTemplate, EmailTemplateDraft, TemplatePart } from '../../types';
import { draftOf, insertAtSelection, mergeToken, sameDraft } from '../../utils/draft';
import { describeFailure, dialogError, fieldDetails } from '../../utils/errors';
import { SaveBar } from '../SaveBar';
import { MergeFieldChips } from './MergeFieldChips';
import { TemplatePreview } from './TemplatePreview';

const PARTS: ReadonlyArray<TemplatePart> = ['subject', 'html_body', 'text_body'];

type Control = HTMLInputElement | HTMLTextAreaElement;

export interface TemplateEditorProps {
  template: EmailTemplate;
  onBack: () => void;
}

/**
 * One email template: subject, HTML body and plain-text body, the merge fields that can be
 * inserted where the cursor is, a live preview (debounced, rendered by the API) and the
 * actions. The API's 422 problems appear on the fields, from the preview as the person types
 * and from a refused save.
 */
export function TemplateEditor({ template, onBack }: TemplateEditorProps) {
  const { toast } = useToast();
  const save = useSaveEmailTemplate();
  const reset = useResetEmailTemplate();
  const [draft, setDraft] = useState<EmailTemplateDraft>(() => draftOf(template));
  const [focused, setFocused] = useState<TemplatePart>('html_body');
  const [saveError, setSaveError] = useState<unknown>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetError, setResetError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const controls = useRef<Record<TemplatePart, Control | null>>({
    subject: null,
    html_body: null,
    text_body: null,
  });

  // The preview follows the draft once typing pauses.
  const shown = useDebouncedValue(draft, PREVIEW_DELAY_MS);
  const updating = !sameDraft(draft, shown);
  const preview = useTemplatePreview(template.key, shown);

  const dirty = !sameDraft(draft, draftOf(template));

  // What the API refused: the preview's answer for the text on screen, else the last save's.
  const previewProblems = updating ? [] : fieldDetails(preview.error);
  const problems = previewProblems.length > 0 ? previewProblems : fieldDetails(saveError);
  const problemsOf = (part: TemplatePart) =>
    problems
      .filter((problem) => problem.field === part)
      .map((problem) => problem.message)
      .join(' ') || undefined;
  const otherProblems = problems.filter(
    (problem) => !(PARTS as ReadonlyArray<string>).includes(problem.field),
  );
  const saveFailed = saveError !== null && fieldDetails(saveError).length === 0;

  const edit = (part: TemplatePart, value: string) => {
    setDraft((previous) => ({ ...previous, [part]: value }));
    setSaveError(null);
  };

  const insert = (name: string) => {
    const control = controls.current[focused];
    const text = draft[focused];
    const result = insertAtSelection(
      text,
      control?.selectionStart ?? text.length,
      control?.selectionEnd ?? text.length,
      mergeToken(name),
    );
    edit(focused, result.text);
    const part = focused;
    // Back into the field, after the inserted field, once the new text is on screen.
    requestAnimationFrame(() => {
      const target = controls.current[part];
      target?.focus();
      target?.setSelectionRange(result.caret, result.caret);
    });
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setSaveError(null);
    save.mutate(
      { key: template.key, draft },
      {
        onSuccess: (saved) => {
          setDraft(draftOf(saved));
          toast({ tone: 'success', title: `${saved.name} saved` });
        },
        onError: (error) => {
          setSaveError(error);
          if (fieldDetails(error).length === 0) {
            toast({ tone: 'error', ...describeFailure(error, 'Could not save the template') });
          }
        },
      },
    );
  };

  const confirmReset = () => {
    reset.mutate(template.key, {
      onSuccess: (restored) => {
        setDraft(draftOf(restored));
        setSaveError(null);
        setConfirmingReset(false);
        toast({ tone: 'success', title: `${restored.name} reset to the default` });
      },
      onError: (error) => setResetError(dialogError(error)),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          leftIcon={<ArrowLeft aria-hidden="true" className="size-4" />}
          onClick={onBack}
        >
          All templates
        </Button>
        <h2 className="text-base font-semibold text-text">{template.name}</h2>
        <Badge tone={template.customised ? 'violet' : 'grey'}>
          {template.customised ? 'Customised' : 'Default'}
        </Badge>
      </div>
      <p className="text-sm text-text-muted">{template.description}</p>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card padding="none">
          <MergeFieldChips
            fields={template.merge_fields}
            required={template.required_fields}
            onInsert={insert}
            disabled={save.isPending}
          />
          <form onSubmit={submit} noValidate>
            <div className="flex flex-col gap-4 px-5 py-4">
              {otherProblems.length > 0 ? (
                <ul
                  role="alert"
                  className="list-disc rounded-md border border-danger/40 bg-danger-soft py-2.5 pr-3 pl-7 text-sm text-text"
                >
                  {otherProblems.map((problem) => (
                    <li key={`${problem.field}:${problem.message}`}>{problem.message}</li>
                  ))}
                </ul>
              ) : null}
              {saveFailed ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  The template could not be saved. Try again.
                </p>
              ) : null}
              <Input
                ref={(node) => {
                  controls.current.subject = node;
                }}
                label="Subject"
                required
                value={draft.subject}
                maxLength={200}
                disabled={save.isPending}
                error={problemsOf('subject')}
                hint="One line."
                onFocus={() => setFocused('subject')}
                onChange={(event) => edit('subject', event.target.value)}
              />
              <Textarea
                ref={(node) => {
                  controls.current.html_body = node;
                }}
                label="Email body (HTML)"
                required
                rows={10}
                value={draft.html_body}
                disabled={save.isPending}
                error={problemsOf('html_body')}
                hint="The message itself, as HTML. It is placed in the practice's branded layout when sent."
                onFocus={() => setFocused('html_body')}
                onChange={(event) => edit('html_body', event.target.value)}
              />
              <Textarea
                ref={(node) => {
                  controls.current.text_body = node;
                }}
                label="Plain text body"
                required
                rows={6}
                value={draft.text_body}
                disabled={save.isPending}
                error={problemsOf('text_body')}
                hint="Shown by email programs that do not display HTML."
                onFocus={() => setFocused('text_body')}
                onChange={(event) => edit('text_body', event.target.value)}
              />
            </div>
            <SaveBar
              dirty={dirty}
              saving={save.isPending}
              saveLabel="Save template"
              onDiscard={() => {
                setDraft(draftOf(template));
                setSaveError(null);
              }}
              leading={
                <Button
                  variant="outline"
                  disabled={!template.customised || save.isPending}
                  onClick={() => {
                    setResetError(null);
                    setConfirmingReset(true);
                  }}
                >
                  Reset to default
                </Button>
              }
            />
          </form>
        </Card>

        <Card padding="md">
          <TemplatePreview preview={preview} updating={updating} />
        </Card>
      </div>

      <ConfirmDialog
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        onConfirm={confirmReset}
        title="Reset to the default?"
        confirmLabel="Reset to default"
        loading={reset.isPending}
        error={resetError}
      >
        <p>
          Your version of “{template.name}” is deleted and the built-in text is used from now on.
          This cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
