import { useState } from 'react';

import { useStaffLookup, useStaffMember } from '../../api';
import type { PickerItem, StaffFilters } from '../../types';
import { staffItem } from './items';
import { LookupCombobox, type LookupComboboxProps } from './LookupCombobox';
import { usePickerSearch } from './usePickerSearch';

export interface StaffPickerProps extends Pick<
  LookupComboboxProps,
  | 'label'
  | 'hideLabel'
  | 'placeholder'
  | 'hint'
  | 'error'
  | 'disabled'
  | 'clearable'
  | 'listPlacement'
  | 'className'
> {
  /** The chosen staff id. */
  value: string | null;
  /** The name to show for `value` when the caller knows it (otherwise it is looked up). */
  valueLabel?: string;
  onChange: (id: string | null, item: PickerItem | null) => void;
  /** Only people who can sign in: approvers. */
  hasLogin?: boolean;
  /** Only people time can be recorded for today. */
  selectable?: boolean;
  /** Also offer people who left (history and reports). */
  includeLeft?: boolean;
  /** Leaves one person out (nobody approves their own timesheet). */
  excludeId?: string;
}

/** Searchable single choice of a staff member, with the restrictions of the field it serves. */
export function StaffPicker({
  value,
  valueLabel,
  onChange,
  hasLogin,
  selectable,
  includeLeft,
  excludeId,
  ...field
}: StaffPickerProps) {
  const search = usePickerSearch();
  // Remembered so the name shows at once, before any lookup of `value` answers.
  const [picked, setPicked] = useState<PickerItem | null>(null);

  const filters: StaffFilters = {
    q: search.query || undefined,
    has_login: hasLogin,
    selectable,
    status: includeLeft ? ['active', 'inactive', 'left'] : undefined,
  };
  const lookup = useStaffLookup(filters, search.open);
  const known = value !== null && (picked?.id === value || valueLabel !== undefined);
  const fetched = useStaffMember(value !== null && !known ? value : null);

  let current: PickerItem | null = null;
  if (value !== null) {
    if (picked?.id === value) current = picked;
    else if (valueLabel !== undefined) current = { id: value, label: valueLabel };
    else if (fetched.data) current = staffItem(fetched.data);
    else current = { id: value, label: 'Selected staff member' };
  }

  const options = (lookup.data ?? []).filter((member) => member.id !== excludeId).map(staffItem);

  return (
    <LookupCombobox
      {...field}
      placeholder={field.placeholder ?? 'Search by name, code or email'}
      value={current}
      options={options}
      loading={lookup.isFetching}
      failed={lookup.isError}
      emptyText="No staff found."
      onQueryChange={search.setText}
      onOpenChange={search.setOpen}
      onChange={(item) => {
        setPicked(item);
        onChange(item?.id ?? null, item);
      }}
    />
  );
}
