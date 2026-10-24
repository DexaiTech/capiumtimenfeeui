import { useId, useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Button, Checkbox, FormPanel, Select } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker, useActivityTypes, useServices } from '@/features/team';

import { useJobRefs } from '../../api';
import { activityOptions } from '../../utils/activities';
import { rowKey, type DraftRow } from '../../utils/grid';
import { DialogActions } from '../DialogActions';

/** What the job picker hands over (the shape of `GET /jobs`). */
interface PickedJob {
  id: string;
  number: string;
  name: string;
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
}

export interface AddRowPanelProps {
  open: boolean;
  onClose: () => void;
  /** Keys of the rows on the sheet, so the same row is not added twice. */
  existingKeys: ReadonlySet<string>;
  onAdd: (row: DraftRow) => void;
}

function AddRowForm({ existingKeys, onAdd, onClose }: Omit<AddRowPanelProps, 'open'>) {
  const { can } = useOrg();
  const formId = useId();
  const [client, setClient] = useState<{ id: string; code: string | null; name: string } | null>(
    null,
  );
  const [job, setJob] = useState<PickedJob | null>(null);
  const [activityId, setActivityId] = useState('');
  const [billableChoice, setBillableChoice] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activities = useActivityTypes();
  const services = useServices();
  const jobRefs = useJobRefs(job ? [job.id] : [], can(PERMISSIONS.jobRead));
  const activity = activities.data?.find((item) => item.id === activityId);
  const clientId = client?.id ?? job?.client_id ?? null;
  const billable =
    billableChoice ??
    (clientId !== null &&
      activity?.is_chargeable !== false &&
      (job ? jobRefs.get(job.id)?.billing_basis !== 'non_billable' : true));

  const submit = () => {
    if (!clientId && !job && !activityId) {
      setError('Choose a client, a job or an activity for the row.');
      return;
    }
    const draft: DraftRow = {
      client_id: clientId,
      client_code: client?.code ?? job?.client_code ?? null,
      client_name: client?.name ?? job?.client_name ?? null,
      job_id: job?.id ?? null,
      job_number: job?.number ?? null,
      job_name: job?.name ?? null,
      activity_code_id: activityId || null,
      activity_code: activity?.code ?? null,
      activity_name: activity?.name ?? null,
      is_billable: billable,
      service_name: job?.service_name ?? null,
    };
    if (existingKeys.has(rowKey(draft))) {
      setError('That row is already on this timesheet. Type in its cells instead.');
      return;
    }
    onAdd(draft);
    onClose();
  };

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
        {can(PERMISSIONS.clientRead) ? (
          <ClientPicker
            label="Client"
            value={client?.id ?? job?.client_id ?? null}
            valueLabel={client?.name ?? job?.client_name}
            placeholder="No client (internal time)"
            onChange={(id, item) => {
              setError(null);
              setClient(item ? { id: item.id, code: item.detail ?? null, name: item.label } : null);
              if (job && job.client_id !== id) setJob(null);
            }}
          />
        ) : null}
        {can(PERMISSIONS.jobRead) ? (
          <JobPicker
            label="Job"
            value={job?.id ?? null}
            valueJob={job ?? undefined}
            clientId={clientId}
            placeholder="No job"
            onChange={(picked) => {
              setError(null);
              setJob(picked);
              if (picked) {
                setClient({
                  id: picked.client_id,
                  code: picked.client_code,
                  name: picked.client_name,
                });
                const allowed = activityOptions(
                  activities.data,
                  services.data,
                  picked.service_id,
                  null,
                );
                if (activityId && !allowed.some((option) => option.value === activityId)) {
                  setActivityId('');
                }
              }
            }}
          />
        ) : null}
        {job?.service_name ? (
          <p className="text-xs text-text-muted">
            Service of the job: <span className="font-medium text-text">{job.service_name}</span>
          </p>
        ) : null}
        <Select
          label="Activity"
          options={activityOptions(activities.data, services.data, job?.service_id ?? null, null)}
          value={activityId}
          onChange={(event) => {
            setError(null);
            setActivityId(event.target.value);
          }}
        />
        <Checkbox
          label="Billable"
          description={
            billableChoice === null
              ? 'Worked out from the client, job and activity until you change it.'
              : undefined
          }
          checked={billable}
          onChange={(event) => setBillableChoice(event.target.checked)}
        />
        {error ? <FormAlert message={error} /> : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary">
          Add row
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Adds a row to the timesheet: a client, a job (its service is shown) and an activity. The row
 * holds no time until a day is typed in, and then the first entry is created.
 */
export function AddRowPanel({ open, onClose, existingKeys, onAdd }: AddRowPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title="Add a row"
      description="Choose what the time is for, then type the hours of each day in the grid."
    >
      {open ? <AddRowForm existingKeys={existingKeys} onAdd={onAdd} onClose={onClose} /> : null}
    </FormPanel>
  );
}
