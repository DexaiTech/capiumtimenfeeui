import { useState } from 'react';

import { BulkBar, Checkbox, ConfirmDialog, DateField, Select, useBulkFlow } from '@/components/ui';
import { MAX_BULK_IDS } from '@/utils/bulk';

import { useBulkTasks, useMembers } from '../api';
import { TASK_STATUS_META } from '../constants';
import { TASK_STATUSES, type TaskBulkRequest, type TaskStatus } from '../types';

type Editing = 'status' | 'due' | 'add_assignee' | 'remove_assignee' | null;

const NOUN = ['task', 'tasks'] as const;

export interface TasksBulkBarProps {
  /** Ids of the ticked tasks (they may belong to different jobs). */
  ids: ReadonlyArray<string>;
  /** `job.update`: due dates, assignees and delete. A status change is open to more people. */
  canEdit: boolean;
  /** Choose the status of tasks the person is assigned to, without `job.update`. */
  canChangeStatus: boolean;
  /** The selection is done with (after a success, or Clear). */
  onClear: () => void;
}

/**
 * Above a task list while rows are ticked: set the status or due date of all of them, add or take
 * away an assignee, or delete them (`POST /tasks/bulk`, all or nothing). A task that breaks a
 * rule of the single action (a closed job, a due date outside the job's dates, time recorded
 * against it) stops the lot, and the dialog names those tasks.
 */
export function TasksBulkBar({ ids, canEdit, canChangeStatus, onClear }: TasksBulkBarProps) {
  const bulk = useBulkTasks();
  const members = useMembers();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<TaskStatus>('in_progress');
  const [due, setDue] = useState<string | null>(null);
  const [clearDue, setClearDue] = useState(false);
  const [person, setPerson] = useState('');

  const flow = useBulkFlow<TaskBulkRequest>({
    run: (body) => bulk.mutateAsync(body),
    noun: NOUN,
    onDone: () => {
      setEditing(null);
      setDeleting(false);
      onClear();
    },
  });

  const close = () => {
    setEditing(null);
    setDeleting(false);
    flow.clearRefusal();
  };
  const count = ids.length;
  const word = count === 1 ? 'task' : 'tasks';
  const task_ids = [...ids];

  const apply = () => {
    if (editing === 'status') {
      void flow.submit({ task_ids, action: 'set_status', value: status }, 'updated');
    } else if (editing === 'due') {
      void flow.submit(
        { task_ids, action: 'set_due_date', value: clearDue ? null : due },
        'updated',
      );
    } else if ((editing === 'add_assignee' || editing === 'remove_assignee') && person) {
      void flow.submit({ task_ids, action: editing, value: person }, 'updated');
    }
  };

  const titles: Record<Exclude<Editing, null>, string> = {
    status: `Set the status of ${count} ${word}`,
    due: `Set the due date of ${count} ${word}`,
    add_assignee: `Assign ${count} ${word} to a person`,
    remove_assignee: `Take a person off ${count} ${word}`,
  };
  const edits = [
    ...(canEdit || canChangeStatus ? [{ value: 'status', label: 'Set status' }] : []),
    ...(canEdit
      ? [
          { value: 'due', label: 'Set due date' },
          { value: 'add_assignee', label: 'Add assignee' },
          { value: 'remove_assignee', label: 'Remove assignee' },
        ]
      : []),
  ];
  const people = [
    { value: '', label: 'Choose a person' },
    ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];

  return (
    <>
      <BulkBar
        noun="tasks"
        count={count}
        busy={flow.busy}
        limit={MAX_BULK_IDS}
        announcement={flow.announcement}
        onClear={onClear}
        editOptions={edits.length > 0 ? edits : undefined}
        onEdit={(value) => {
          flow.clearRefusal();
          setEditing(value as Editing);
        }}
        onDelete={
          canEdit
            ? () => {
                flow.clearRefusal();
                setDeleting(true);
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={editing !== null}
        onClose={close}
        onConfirm={apply}
        title={editing ? titles[editing] : 'Edit tasks'}
        confirmLabel={`Update ${count} ${word}`}
        tone="default"
        loading={flow.busy}
        confirmDisabled={
          (editing === 'due' && !clearDue && due === null) ||
          ((editing === 'add_assignee' || editing === 'remove_assignee') && person === '')
        }
        error={flow.refusal}
      >
        <p>
          The change is made to every selected task or to none: a task that cannot take it (a closed
          job, a due date outside the job&apos;s dates) stops the lot.
        </p>
        {editing === 'status' ? (
          <Select
            label="New status"
            options={TASK_STATUSES.map((value) => ({
              value,
              label: TASK_STATUS_META[value].label,
            }))}
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
          />
        ) : null}
        {editing === 'due' ? (
          <>
            <DateField
              label="New due date"
              value={due}
              onChange={setDue}
              disabled={clearDue}
              required={!clearDue}
            />
            <Checkbox
              label="Clear the due date instead"
              checked={clearDue}
              onChange={(event) => setClearDue(event.target.checked)}
            />
          </>
        ) : null}
        {editing === 'add_assignee' || editing === 'remove_assignee' ? (
          <Select
            label={editing === 'add_assignee' ? 'Person to add' : 'Person to remove'}
            options={people}
            value={person}
            required
            onChange={(event) => setPerson(event.target.value)}
          />
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting}
        onClose={close}
        onConfirm={() => void flow.submit({ task_ids, action: 'delete' }, 'deleted')}
        title={`Delete ${count} ${word}?`}
        confirmLabel={`Delete ${count} ${word}`}
        loading={flow.busy}
        error={flow.refusal}
      >
        <p>
          The {count} selected {word} will be removed from their jobs. A task with time logged
          against it cannot be deleted: if any of the selected tasks has, none is deleted and the
          dialog lists them. Mark those completed instead.
        </p>
      </ConfirmDialog>
    </>
  );
}
