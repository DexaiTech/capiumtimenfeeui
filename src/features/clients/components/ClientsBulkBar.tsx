import { useState } from 'react';

import { BulkBar, Checkbox, ConfirmDialog, Select, type BulkFlow } from '@/components/ui';
import { useSegments } from '@/features/settings';
import { MAX_BULK_IDS } from '@/utils/bulk';

import { CLIENT_STATUS_OPTIONS } from '../constants';
import type { ClientBulkRequest, ClientStatus, MemberRead } from '../types';

type Editing = 'status' | 'manager' | 'partner' | 'segment' | null;

const EDITS = [
  { value: 'status', label: 'Set status' },
  { value: 'manager', label: 'Set manager' },
  { value: 'partner', label: 'Set partner' },
  { value: 'segment', label: 'Set segment' },
] as const;

export interface ClientsBulkBarProps {
  /** Ids of the ticked clients. */
  ids: ReadonlyArray<string>;
  members: ReadonlyArray<MemberRead>;
  canUpdate: boolean;
  /** Archiving and deleting both need `client.delete`. */
  canDelete: boolean;
  /** The call shared with the toolbar's "Archive selected" (one flow, one refusal). */
  flow: BulkFlow<ClientBulkRequest>;
  /** Clear the selection. */
  onClear: () => void;
}

/**
 * Above the client list while rows are ticked: set the status, manager, partner or segment of all
 * of them, or delete them (`POST /clients/bulk`, all or nothing). A client that is in use stops a
 * delete, and the dialog names it; archive such clients instead.
 */
export function ClientsBulkBar({
  ids,
  members,
  canUpdate,
  canDelete,
  flow,
  onClear,
}: ClientsBulkBarProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<ClientStatus>('active');
  const [person, setPerson] = useState('');
  const [segment, setSegment] = useState('');
  const [clearSegment, setClearSegment] = useState(false);
  const segments = useSegments();

  const count = ids.length;
  const word = count === 1 ? 'client' : 'clients';
  const client_ids = [...ids];
  const close = () => {
    setEditing(null);
    setDeleting(false);
    flow.clearRefusal();
  };

  const finish = async (body: ClientBulkRequest, verb: string) => {
    if (await flow.submit(body, verb)) {
      setEditing(null);
      setDeleting(false);
    }
  };

  const apply = () => {
    if (editing === 'status') {
      void finish({ client_ids, action: 'set_status', value: status }, 'updated');
    } else if (editing === 'manager' || editing === 'partner') {
      void finish(
        {
          client_ids,
          action: editing === 'manager' ? 'set_manager' : 'set_partner',
          value: person || null,
        },
        'updated',
      );
    } else if (editing === 'segment') {
      void finish(
        { client_ids, action: 'set_segment', value: clearSegment ? null : segment.trim() || null },
        'updated',
      );
    }
  };

  const titles = {
    status: `Set the status of ${count} ${word}`,
    manager: `Set the manager of ${count} ${word}`,
    partner: `Set the partner of ${count} ${word}`,
    segment: `Set the segment of ${count} ${word}`,
  };
  const people = [
    { value: '', label: 'No one (clear it)' },
    ...members.map((member) => ({ value: member.user_id, label: member.full_name })),
  ];
  // Archiving and un-archiving need `client.delete`, so a person without it cannot pick archived.
  const statusOptions = CLIENT_STATUS_OPTIONS.filter(
    (option) => canDelete || option.value !== 'archived',
  );

  return (
    <div className="px-1 py-2">
      <BulkBar
        noun="clients"
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
        title={editing ? titles[editing] : 'Edit clients'}
        confirmLabel={`Update ${count} ${word}`}
        tone="default"
        loading={flow.busy}
        confirmDisabled={editing === 'segment' && !clearSegment && segment.trim() === ''}
        error={flow.refusal}
      >
        <p>The change is made to every selected client or to none.</p>
        {editing === 'status' ? (
          <Select
            label="New status"
            options={statusOptions}
            value={status}
            onChange={(event) => setStatus(event.target.value as ClientStatus)}
          />
        ) : null}
        {editing === 'manager' || editing === 'partner' ? (
          <Select
            label={editing === 'manager' ? 'New manager' : 'New partner'}
            options={people}
            value={person}
            onChange={(event) => setPerson(event.target.value)}
          />
        ) : null}
        {editing === 'segment' ? (
          <>
            <Select
              label="New segment"
              required={!clearSegment}
              placeholder="Choose a segment"
              options={(segments.data ?? [])
                .filter((entry) => entry.is_active)
                .map((entry) => ({ value: entry.name, label: entry.name }))}
              value={segment}
              disabled={clearSegment}
              hint="Chosen from the segments in Settings."
              onChange={(event) => setSegment(event.target.value)}
            />
            <Checkbox
              label="Clear the segment instead"
              checked={clearSegment}
              onChange={(event) => setClearSegment(event.target.checked)}
            />
          </>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting}
        onClose={close}
        onConfirm={() => void finish({ client_ids, action: 'delete' }, 'deleted')}
        title={`Delete ${count} ${word}?`}
        confirmLabel={`Delete ${count} ${word}`}
        loading={flow.busy}
        error={flow.refusal}
      >
        <p>
          The {count} selected {word} will be deleted and their codes freed. A client with jobs,
          time, expenses, invoices or payments cannot be deleted: if any of the selected clients
          has, none is deleted and the dialog lists them. Archive those instead.
        </p>
      </ConfirmDialog>
    </div>
  );
}
