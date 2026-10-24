import { useState } from 'react';

import { BulkBar, Checkbox, ConfirmDialog, DateField, Select, useBulkFlow } from '@/components/ui';
import { MAX_BULK_IDS } from '@/utils/bulk';

import { useBulkJobs, useMembers } from '../api';
import { JOB_STATUS_META } from '../constants';
import { JOB_STATUSES, type JobBulkRequest, type JobStatus } from '../types';

type Editing = 'status' | 'manager' | 'due' | null;

const NOUN = ['job', 'jobs'] as const;
const EDITS = [
  { value: 'status', label: 'Set status' },
  { value: 'manager', label: 'Set manager' },
  { value: 'due', label: 'Set due date' },
] as const;

export interface JobsBulkBarProps {
  /** Ids of the ticked jobs. */
  ids: ReadonlyArray<string>;
  canUpdate: boolean;
  canDelete: boolean;
  /** The selection is done with (after a success, or Clear). */
  onClear: () => void;
}

/**
 * Above the job list while rows are ticked: set the status, manager or due date of all of them,
 * or delete them (`POST /jobs/bulk`, all or nothing). A job that breaks a rule of the single
 * action stops the lot; the dialog names those jobs.
 */
export function JobsBulkBar({ ids, canUpdate, canDelete, onClear }: JobsBulkBarProps) {
  const bulk = useBulkJobs();
  const members = useMembers();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<JobStatus>('in_progress');
  const [manager, setManager] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [clearDue, setClearDue] = useState(false);

  const flow = useBulkFlow<JobBulkRequest>({
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
  const word = count === 1 ? 'job' : 'jobs';
  const job_ids = [...ids];

  const apply = () => {
    if (editing === 'status') {
      void flow.submit({ job_ids, action: 'set_status', value: status }, 'updated');
    } else if (editing === 'manager') {
      void flow.submit({ job_ids, action: 'set_manager', value: manager || null }, 'updated');
    } else if (editing === 'due') {
      void flow.submit(
        { job_ids, action: 'set_due_date', value: clearDue ? null : due },
        'updated',
      );
    }
  };

  const titles = {
    status: `Set the status of ${count} ${word}`,
    manager: `Set the manager of ${count} ${word}`,
    due: `Set the due date of ${count} ${word}`,
  };

  return (
    <>
      <BulkBar
        noun="jobs"
        count={count}
        busy={flow.busy}
        limit={MAX_BULK_IDS}
        announcement={flow.announcement}
        onClear={onClear}
        editOptions={canUpdate ? EDITS : undefined}
        onEdit={(value) => {
          flow.clearRefusal();
          setEditing(value as Editing);
        }}
        onDelete={
          canDelete
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
        title={editing ? titles[editing] : 'Edit jobs'}
        confirmLabel={`Update ${count} ${word}`}
        tone="default"
        loading={flow.busy}
        confirmDisabled={editing === 'due' && !clearDue && due === null}
        error={flow.refusal}
      >
        <p>
          The change is made to every selected job or to none: a job that cannot take it (a status
          it cannot move to, a due date before its start) stops the lot.
        </p>
        {editing === 'status' ? (
          <Select
            label="New status"
            options={JOB_STATUSES.map((value) => ({
              value,
              label: JOB_STATUS_META[value].label,
            }))}
            value={status}
            onChange={(event) => setStatus(event.target.value as JobStatus)}
          />
        ) : null}
        {editing === 'manager' ? (
          <Select
            label="New manager"
            options={[
              { value: '', label: 'No manager (clear it)' },
              ...(members.data ?? []).map((member) => ({
                value: member.user_id,
                label: member.full_name,
              })),
            ]}
            value={manager}
            onChange={(event) => setManager(event.target.value)}
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
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting}
        onClose={close}
        onConfirm={() => void flow.submit({ job_ids, action: 'delete' }, 'deleted')}
        title={`Delete ${count} ${word}?`}
        confirmLabel={`Delete ${count} ${word}`}
        loading={flow.busy}
        error={flow.refusal}
      >
        <p>
          The {count} selected {word} and their tasks will be removed. A job with time, expenses or
          invoices against it cannot be deleted: if any of the selected jobs has, none is deleted
          and the dialog lists them. Complete or cancel those instead.
        </p>
      </ConfirmDialog>
    </>
  );
}
