import { useState } from 'react';

import {
  BulkBar,
  ConfirmDialog,
  Input,
  Select,
  type BulkFlow,
  type PickerOption,
} from '@/components/ui';
import { MAX_BULK_IDS } from '@/utils/bulk';

import type { Grade, StaffBulkRequest } from '../../types';
import { StaffPicker } from '../pickers/StaffPicker';

type Editing = 'grade' | 'approver' | 'clear_approver' | 'deactivate' | 'reactivate' | null;

export interface StaffBulkBarProps {
  /** Ids of the ticked people. */
  ids: ReadonlyArray<string>;
  grades: ReadonlyArray<Grade>;
  /** `member.update`: grade, approver and reactivate. */
  canUpdate: boolean;
  /** `member.remove`: deactivate and delete. */
  canRemove: boolean;
  flow: BulkFlow<StaffBulkRequest>;
  /** Clear the selection. */
  onClear: () => void;
}

/**
 * Above the staff list while rows are ticked: set the grade or approver, deactivate or reactivate
 * all of them, or delete them (`POST /staff/bulk`, all or nothing). Each person is held to the
 * rules of the single action (nobody deactivates or deletes themselves, a person with records
 * cannot be deleted), and a refusal names every person it stopped.
 */
export function StaffBulkBar({
  ids,
  grades,
  canUpdate,
  canRemove,
  flow,
  onClear,
}: StaffBulkBarProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState(false);
  const [gradeId, setGradeId] = useState('');
  const [approverId, setApproverId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<'inactive' | 'left'>('inactive');
  const [leavingDate, setLeavingDate] = useState('');

  const count = ids.length;
  const word = count === 1 ? 'person' : 'people';
  const staff_ids = [...ids];
  const close = () => {
    setEditing(null);
    setDeleting(false);
    flow.clearRefusal();
  };
  const finish = async (body: StaffBulkRequest, verb: string) => {
    if (await flow.submit(body, verb)) close();
  };

  const edits: PickerOption[] = [
    ...(canUpdate
      ? [
          { value: 'grade', label: 'Set grade' },
          { value: 'approver', label: 'Set approver' },
          { value: 'clear_approver', label: 'Clear approver' },
          { value: 'reactivate', label: 'Reactivate' },
        ]
      : []),
    ...(canRemove ? [{ value: 'deactivate', label: 'Deactivate…' }] : []),
  ];

  const apply = () => {
    if (editing === 'grade') {
      void finish({ staff_ids, action: 'set_grade', value: gradeId }, 'updated');
    } else if (editing === 'approver' && approverId) {
      void finish({ staff_ids, action: 'set_approver', value: approverId }, 'updated');
    } else if (editing === 'clear_approver') {
      void finish({ staff_ids, action: 'clear_approver' }, 'updated');
    } else if (editing === 'reactivate') {
      void finish({ staff_ids, action: 'reactivate' }, 'reactivated');
    } else if (editing === 'deactivate') {
      void finish(
        {
          staff_ids,
          action: 'deactivate',
          value: leaving,
          ...(leaving === 'left' && leavingDate ? { leaving_date: leavingDate } : {}),
        },
        leaving === 'left' ? 'marked as left' : 'deactivated',
      );
    }
  };

  const titles: Record<Exclude<Editing, null>, string> = {
    grade: `Set the grade of ${count} ${word}`,
    approver: `Set the approver of ${count} ${word}`,
    clear_approver: `Clear the approver of ${count} ${word}`,
    reactivate: `Reactivate ${count} ${word}`,
    deactivate: `Deactivate ${count} ${word}`,
  };
  const confirmLabels: Record<Exclude<Editing, null>, string> = {
    grade: `Update ${count} ${word}`,
    approver: `Update ${count} ${word}`,
    clear_approver: `Clear ${count} ${word}`,
    reactivate: `Reactivate ${count} ${word}`,
    deactivate:
      leaving === 'left' ? `Mark ${count} ${word} as left` : `Deactivate ${count} ${word}`,
  };
  const gradeOptions = grades
    .filter((grade) => grade.is_active)
    .map((grade) => ({ value: grade.id, label: grade.name }));

  return (
    <div className="px-1 py-2">
      <BulkBar
        noun="staff"
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
          canRemove
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
        title={editing ? titles[editing] : 'Edit staff'}
        confirmLabel={editing ? confirmLabels[editing] : 'Update'}
        tone={editing === 'deactivate' ? 'danger' : 'default'}
        loading={flow.busy}
        confirmDisabled={
          (editing === 'grade' && gradeId === '') || (editing === 'approver' && !approverId)
        }
        error={flow.refusal}
      >
        <p>The change is made to every selected person or to none.</p>
        {editing === 'grade' ? (
          <Select
            label="New grade"
            required
            placeholder="Choose a grade"
            options={gradeOptions}
            value={gradeId}
            onChange={(event) => setGradeId(event.target.value)}
          />
        ) : null}
        {editing === 'approver' ? (
          <StaffPicker
            label="New approver"
            required
            value={approverId}
            onChange={(id) => setApproverId(id)}
            hasLogin
            selectable
            placeholder="Choose an approver"
            hint="Only people who can sign in can approve timesheets."
          />
        ) : null}
        {editing === 'clear_approver' ? (
          <p>They will have no approver until you choose one.</p>
        ) : null}
        {editing === 'deactivate' ? (
          <>
            <Select
              label="What happens to them"
              options={[
                { value: 'inactive', label: 'Deactivate: paused, can come back' },
                { value: 'left', label: 'Mark as left: no longer works for the practice' },
              ]}
              value={leaving}
              onChange={(event) => setLeaving(event.target.value as 'inactive' | 'left')}
            />
            {leaving === 'left' ? (
              <Input
                label="Leaving date"
                type="date"
                hint="Empty: today."
                value={leavingDate}
                onChange={(event) => setLeavingDate(event.target.value)}
              />
            ) : null}
            <p>
              Their records stay. People who can sign in are signed out. Nobody can deactivate
              themselves, and the practice keeps an administrator.
            </p>
          </>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting}
        onClose={close}
        onConfirm={() => void finish({ staff_ids, action: 'delete' }, 'deleted')}
        title={`Delete ${count} ${word}?`}
        confirmLabel={`Delete ${count} ${word}`}
        loading={flow.busy}
        error={flow.refusal}
      >
        <p>
          The {count} selected {word} will be deleted completely. Someone with time, expenses,
          rates, invoices or other records cannot be deleted: if any of the selected people has,
          none is deleted and this dialog lists them. Deactivate those instead.
        </p>
      </ConfirmDialog>
    </div>
  );
}
