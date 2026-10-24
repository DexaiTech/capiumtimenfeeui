import { useState } from 'react';

import { useJobLookup, useJobOption } from '../../api';
import type { JobOption, PickerItem } from '../../types';
import { jobItem } from './items';
import { LookupCombobox, type LookupComboboxProps } from './LookupCombobox';
import { usePickerSearch } from './usePickerSearch';

export interface JobPickerProps extends Pick<
  LookupComboboxProps,
  | 'label'
  | 'hideLabel'
  | 'placeholder'
  | 'hint'
  | 'error'
  | 'required'
  | 'disabled'
  | 'clearable'
  | 'listPlacement'
  | 'className'
> {
  /** The chosen job id. */
  value: string | null;
  /** The job to show for `value` when the caller knows it (otherwise it is looked up). */
  valueJob?: JobOption;
  /** Only the jobs of this client. */
  clientId?: string | null;
  onChange: (job: JobOption | null) => void;
}

/** Searchable single choice of a job. The caller shows it only to people with `job.read`. */
export function JobPicker({
  value,
  valueJob,
  clientId = null,
  onChange,
  ...field
}: JobPickerProps) {
  const search = usePickerSearch();
  const [picked, setPicked] = useState<JobOption | null>(null);

  const lookup = useJobLookup(search.query, clientId, search.open);
  const known = value !== null && (picked?.id === value || valueJob?.id === value);
  const fetched = useJobOption(value, !known);

  let current: PickerItem | null = null;
  if (value !== null) {
    const job = picked?.id === value ? picked : valueJob?.id === value ? valueJob : fetched.data;
    current = job ? jobItem(job) : { id: value, label: 'Selected job' };
  }

  return (
    <LookupCombobox
      {...field}
      placeholder={field.placeholder ?? 'Search by number or name'}
      value={current}
      options={(lookup.data ?? []).map(jobItem)}
      loading={lookup.isFetching}
      failed={lookup.isError}
      emptyText="No jobs found."
      onQueryChange={search.setText}
      onOpenChange={search.setOpen}
      onChange={(item) => {
        const job = item
          ? ((lookup.data ?? []).find((entry) => entry.id === item.id) ?? null)
          : null;
        setPicked(job);
        onChange(job);
      }}
    />
  );
}
