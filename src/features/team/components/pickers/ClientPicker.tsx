import { useState } from 'react';

import { useClientLookup, useClientOption } from '../../api';
import type { PickerItem } from '../../types';
import { clientItem } from './items';
import { LookupCombobox, type LookupComboboxProps } from './LookupCombobox';
import { usePickerSearch } from './usePickerSearch';

export interface ClientPickerProps extends Pick<
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
  /** The chosen client id. */
  value: string | null;
  /** The name to show for `value` when the caller knows it (otherwise it is looked up). */
  valueLabel?: string;
  onChange: (id: string | null, item: PickerItem | null) => void;
}

/** Searchable single choice of a client. The caller shows it only to people with `client.read`. */
export function ClientPicker({ value, valueLabel, onChange, ...field }: ClientPickerProps) {
  const search = usePickerSearch();
  const [picked, setPicked] = useState<PickerItem | null>(null);

  const lookup = useClientLookup(search.query, search.open);
  const known = value !== null && (picked?.id === value || valueLabel !== undefined);
  const fetched = useClientOption(value, !known);

  let current: PickerItem | null = null;
  if (value !== null) {
    if (picked?.id === value) current = picked;
    else if (valueLabel !== undefined) current = { id: value, label: valueLabel };
    else if (fetched.data) current = clientItem(fetched.data);
    else current = { id: value, label: 'Selected client' };
  }

  return (
    <LookupCombobox
      {...field}
      placeholder={field.placeholder ?? 'Search by name or code'}
      value={current}
      options={(lookup.data ?? []).map(clientItem)}
      loading={lookup.isFetching}
      failed={lookup.isError}
      emptyText="No clients found."
      onQueryChange={search.setText}
      onOpenChange={search.setOpen}
      onChange={(item) => {
        setPicked(item);
        onChange(item?.id ?? null, item);
      }}
    />
  );
}
