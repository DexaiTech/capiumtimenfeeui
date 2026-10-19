import { Eye } from 'lucide-react';
import type { SyntheticEvent } from 'react';

import { Button, Checkbox, Input } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';

import type { ScopeErrors, ScopeState } from '../../schemas/rerate';
import type { PickerItem } from '../../types';
import { ChipField } from '../pickers/ChipField';
import { ClientPicker } from '../pickers/ClientPicker';
import { jobItem } from '../pickers/items';
import { JobPicker } from '../pickers/JobPicker';
import { StaffPicker } from '../pickers/StaffPicker';

export interface RerateScopeFormProps {
  formId: string;
  value: ScopeState;
  errors: ScopeErrors;
  onChange: (patch: Partial<ScopeState>) => void;
  onSubmit: () => void;
  onReset: () => void;
  submitting: boolean;
}

const add = (items: PickerItem[], item: PickerItem | null): PickerItem[] =>
  item && !items.some((entry) => entry.id === item.id) ? [...items, item] : items;

/**
 * Step 1 of a re-rate: which unbilled time to look at. Clients, jobs and staff are added as
 * chips; a date range needs both ends. Changing anything here discards the preview made from
 * the old scope (the parent does that in `onChange`).
 */
export function RerateScopeForm({
  formId,
  value,
  errors,
  onChange,
  onSubmit,
  onReset,
  submitting,
}: RerateScopeFormProps) {
  const { can } = useOrg();
  const canPickClient = can(PERMISSIONS.clientRead);
  const canPickJob = can(PERMISSIONS.jobRead);
  const canPickStaff = can(PERMISSIONS.memberRead);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form id={formId} noValidate onSubmit={submit} className="grid gap-5 p-5 md:grid-cols-2">
      {canPickClient ? (
        <ChipField
          label="Clients"
          items={value.clients}
          onRemove={(id) => onChange({ clients: value.clients.filter((item) => item.id !== id) })}
          emptyText="All clients."
          error={errors.clients}
        >
          <ClientPicker
            label="Add a client"
            hideLabel
            value={null}
            onChange={(_id, item) => onChange({ clients: add(value.clients, item) })}
            placeholder="Add a client"
          />
        </ChipField>
      ) : null}
      {canPickJob ? (
        <ChipField
          label="Jobs"
          items={value.jobs}
          onRemove={(id) => onChange({ jobs: value.jobs.filter((item) => item.id !== id) })}
          emptyText="All jobs."
          error={errors.jobs}
        >
          <JobPicker
            label="Add a job"
            hideLabel
            value={null}
            onChange={(job) => onChange({ jobs: add(value.jobs, job ? jobItem(job) : null) })}
            placeholder="Add a job"
          />
        </ChipField>
      ) : null}
      {canPickStaff ? (
        <ChipField
          label="Staff"
          items={value.staff}
          onRemove={(id) => onChange({ staff: value.staff.filter((item) => item.id !== id) })}
          emptyText="Everyone."
          error={errors.staff}
        >
          <StaffPicker
            label="Add a staff member"
            hideLabel
            value={null}
            onChange={(_id, item) => onChange({ staff: add(value.staff, item) })}
            includeLeft
            placeholder="Add a staff member"
          />
        </ChipField>
      ) : null}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-sm font-medium text-text">Dates of the time</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="From"
            type="date"
            value={value.date_from}
            error={errors.date_from}
            onChange={(event) => onChange({ date_from: event.target.value })}
          />
          <Input
            label="To"
            type="date"
            value={value.date_to}
            error={errors.date_to}
            onChange={(event) => onChange({ date_to: event.target.value })}
          />
        </div>
        <p className="text-xs text-text-muted">
          Choose clients, jobs or a date range (both dates). Each choice narrows the time looked at.
        </p>
      </fieldset>
      <div className="flex flex-col gap-3 md:col-span-2">
        <Checkbox
          label="Also list the entries that would not change"
          description="They are counted either way; listing them makes a long preview longer."
          checked={value.include_unchanged}
          onChange={(event) => onChange({ include_unchanged: event.target.checked })}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onReset}>Clear</Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            leftIcon={<Eye aria-hidden="true" className="size-4" />}
            loading={submitting}
          >
            Preview re-rate
          </Button>
        </div>
      </div>
    </form>
  );
}
