import { ArrowDown, ArrowUp, ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { Button, DurationInput, Input, Textarea } from '@/components/ui';
import { parseTaskLines } from '@/utils/taskLines';

import {
  MAX_BUDGET_MINUTES,
  MAX_DESCRIPTION,
  MAX_OFFSET_DAYS,
  MAX_TEMPLATES,
  MAX_TITLE,
  newRow,
  validateRows,
  type TemplateRow,
} from './taskTemplateRows';

export interface TaskTemplateEditorProps {
  rows: ReadonlyArray<TemplateRow>;
  onChange: (rows: TemplateRow[]) => void;
  /** Shows what is wrong with each row (after a first attempt to save). */
  showErrors?: boolean;
  disabled?: boolean;
}

/**
 * The default tasks of a service, in order: a title, an optional hours budget, an optional due
 * date counted in days from the job's start, and an optional description. Rows are added,
 * removed and moved; a pasted list (one task per line) becomes rows.
 */
export function TaskTemplateEditor({
  rows,
  onChange,
  showErrors = false,
  disabled = false,
}: TaskTemplateEditorProps) {
  const pasteId = useId();
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState<string | undefined>();

  const errors = showErrors ? validateRows(rows) : [];
  const full = rows.length >= MAX_TEMPLATES;
  const titles = parseTaskLines(pasted);

  const change = (index: number, patch: Partial<TemplateRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index + by, 0, moved);
    onChange(next);
  };

  const addPasted = () => {
    if (titles.length === 0) {
      setPasteError('Paste at least one line.');
      return;
    }
    const room = MAX_TEMPLATES - rows.length;
    if (titles.length > room) {
      setPasteError(
        room === 0
          ? `A service takes at most ${String(MAX_TEMPLATES)} default tasks.`
          : `Only ${String(room)} more ${room === 1 ? 'task fits' : 'tasks fit'} (at most ${String(MAX_TEMPLATES)}); this list has ${String(titles.length)}.`,
      );
      return;
    }
    onChange([...rows, ...titles.map((title) => newRow(title))]);
    setPasted('');
    setPasteError(undefined);
    setPasting(false);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-text">Default tasks</legend>
      <p className="text-xs text-text-muted">
        New jobs of this service can start with these tasks, in this order. A due date counts days
        from the start date of the job.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-border px-3 py-2 text-sm text-text-muted">
          No default tasks yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const number = index + 1;
            const rowErrors = errors[index];
            return (
              <li key={row.key}>
                <div
                  role="group"
                  aria-label={`Default task ${String(number)}`}
                  className="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-2.5 w-6 shrink-0 text-xs font-medium text-text-muted tabular-nums md:mt-2"
                    >
                      {number}.
                    </span>
                    <Input
                      label="Title"
                      required
                      autoComplete="off"
                      maxLength={MAX_TITLE}
                      className="min-w-0 flex-1"
                      value={row.title}
                      error={rowErrors?.title}
                      onChange={(event) => change(index, { title: event.target.value })}
                    />
                    <div className="mt-6 flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move task ${String(number)} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move task ${String(number)} down`}
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove task ${String(number)}`}
                        onClick={() => onChange(rows.filter((_, at) => at !== index))}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DurationInput
                      label="Hours budget"
                      value={row.budget_minutes}
                      max={MAX_BUDGET_MINUTES}
                      hint="For example 1:30 or 2"
                      onCommit={(minutes) => change(index, { budget_minutes: minutes })}
                    />
                    <Input
                      label="Due (days after the job starts)"
                      inputMode="numeric"
                      autoComplete="off"
                      hint={`0 to ${String(MAX_OFFSET_DAYS)}. Empty for no due date.`}
                      value={row.due_offset_days}
                      error={rowErrors?.due_offset_days}
                      onChange={(event) => change(index, { due_offset_days: event.target.value })}
                    />
                  </div>
                  <Textarea
                    label="Description"
                    rows={2}
                    maxLength={MAX_DESCRIPTION}
                    value={row.description}
                    error={rowErrors?.description}
                    onChange={(event) => change(index, { description: event.target.value })}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={full}
          leftIcon={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => onChange([...rows, newRow()])}
        >
          Add task
        </Button>
        <Button
          size="sm"
          disabled={full}
          aria-expanded={pasting}
          leftIcon={<ClipboardPaste aria-hidden="true" className="size-4" />}
          onClick={() => setPasting((open) => !open)}
        >
          Paste a list
        </Button>
        <span className="text-xs text-text-muted">
          {rows.length} of {MAX_TEMPLATES}
        </span>
      </div>
      {pasting ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Textarea
            id={pasteId}
            label="Tasks to add"
            rows={4}
            hint="One task per line. A bulleted or numbered list can be pasted as it is."
            error={pasteError}
            value={pasted}
            onChange={(event) => {
              setPasted(event.target.value);
              setPasteError(undefined);
            }}
          />
          <div>
            <Button size="sm" variant="primary" onClick={addPasted}>
              {titles.length === 0
                ? 'Add these tasks'
                : `Add ${String(titles.length)} ${titles.length === 1 ? 'task' : 'tasks'}`}
            </Button>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
