import { useMemo, useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, DateField, Select, Textarea, useToast } from '@/components/ui';
import { describeBulkError, type BulkRefusal } from '@/utils/bulk';

import { useCreateTasksBulk } from '../api';
import { LIMITS, MAX_TASKS_PER_JOB, TASK_STATUS_META } from '../constants';
import { TASK_STATUSES, type Job, type TaskStatus } from '../types';
import { MAX_NEW_TASKS, parseTaskLines } from '../utils/taskLines';
import { AssigneePicker } from './AssigneePicker';
import { DialogActions } from './DialogActions';

const STATUS_OPTIONS = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_META[status].label,
}));

export interface TasksBulkAddFormProps {
  job: Job;
  formId: string;
  onClose: () => void;
}

/**
 * "Add several tasks": one task per line (a pasted bulleted or numbered list works), with the
 * status, due date and assignees they all start with. They are added in the order written, all
 * or nothing: a task the job cannot take stops the lot and the form names it.
 */
export function TasksBulkAddForm({ job, formId, onClose }: TasksBulkAddFormProps) {
  const { toast } = useToast();
  const create = useCreateTasksBulk();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [due, setDue] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | undefined>();
  const [refusal, setRefusal] = useState<BulkRefusal | null>(null);

  const titles = useMemo(() => parseTaskLines(text), [text]);
  const room = Math.max(0, MAX_TASKS_PER_JOB - job.task_counts.total);

  const check = (): string | undefined => {
    if (titles.length === 0) return 'Write at least one task, one per line.';
    if (titles.length > MAX_NEW_TASKS) {
      return `Add at most ${String(MAX_NEW_TASKS)} tasks at a time.`;
    }
    const long = titles.findIndex((title) => title.length > LIMITS.taskTitle);
    if (long >= 0) {
      return `Task ${String(long + 1)} is longer than ${String(LIMITS.taskTitle)} characters.`;
    }
    if (titles.length > room) {
      return `This job has room for ${String(room)} more ${room === 1 ? 'task' : 'tasks'}.`;
    }
    return undefined;
  };

  const submit = () => {
    const invalid = check();
    setProblem(invalid);
    setRefusal(null);
    if (invalid) return;
    create.mutate(
      {
        jobId: job.id,
        body: {
          tasks: titles.map((title) => ({
            title,
            status,
            due_date: due,
            ...(assignees.length > 0 ? { assignee_user_ids: assignees } : {}),
          })),
        },
      },
      {
        onSuccess: (created) => {
          toast({
            tone: 'success',
            title: `${String(created.length)} ${created.length === 1 ? 'task' : 'tasks'} added`,
            description: job.name,
          });
          onClose();
        },
        onError: (error) => setRefusal(describeBulkError(error)),
      },
    );
  };

  const count = titles.length;
  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <Textarea
          label="Tasks"
          required
          rows={7}
          placeholder={'Prepare the accounts\nReview with the partner\nFile at Companies House'}
          hint={
            count === 0
              ? 'One task per line. A pasted bulleted or numbered list works.'
              : `${String(count)} ${count === 1 ? 'task' : 'tasks'} to add.`
          }
          error={problem}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setProblem(undefined);
          }}
        />
        <p className="text-xs text-text-muted">
          These start the same way. Edit a task afterwards to give it its own description or budget.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Starts as"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
          />
          <DateField
            label="Due date"
            value={due}
            min={job.start_date}
            max={job.due_date}
            onChange={setDue}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text">Assigned to</span>
          <AssigneePicker
            label="Assignees of the new tasks"
            value={assignees}
            onChange={setAssignees}
          />
        </div>
        {refusal ? (
          <div className="flex flex-col gap-2">
            <FormAlert message={refusal.message} requestId={refusal.requestId} />
            {refusal.items.length > 0 ? (
              <ul aria-label="Tasks refused" className="list-disc pl-6 text-xs text-text">
                {refusal.items.map((item) => (
                  <li key={`${item.label}:${item.reason}`}>
                    <span className="font-semibold">{item.label}</span>: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
          {count > 1 ? `Add ${String(count)} tasks` : 'Add task'}
        </Button>
      </DialogActions>
    </>
  );
}
