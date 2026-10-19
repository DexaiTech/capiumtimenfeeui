import { ChevronDown, Users } from 'lucide-react';

import { OptionPicker, type PickerOption } from '@/components/ui';

import { useMemberNames, useMembers } from '../api';

export interface AssigneePickerProps {
  /** Accessible name of the picker, for example "Assignees of J00001". */
  label: string;
  /** The assigned people, by user id. */
  value: ReadonlyArray<string>;
  /** Names for people who are no longer active members (a task names its assignees itself). */
  knownNames?: ReadonlyMap<string, string | null>;
  disabled?: boolean;
  /** Called once, when the list closes, with the complete new list. */
  onChange: (userIds: string[]) => void;
}

/** Who a job or a task is assigned to: names on a button that opens a searchable multi-select. */
export function AssigneePicker({
  label,
  value,
  knownNames,
  disabled = false,
  onChange,
}: AssigneePickerProps) {
  const members = useMembers();
  const nameOf = useMemberNames();

  const options: PickerOption[] = (members.data ?? []).map((member) => ({
    value: member.user_id,
    label: member.full_name,
    description: member.email,
  }));
  // A person who left stays in the list so they can be taken off.
  for (const id of value) {
    if (!options.some((option) => option.value === id)) {
      options.push({ value: id, label: knownNames?.get(id) ?? 'Former member' });
    }
  }
  const shown = value.map((id) => nameOf(id) ?? knownNames?.get(id) ?? 'Former member');

  if (disabled) {
    return <span className="text-sm text-text">{shown.length > 0 ? shown.join(', ') : '—'}</span>;
  }
  return (
    <OptionPicker
      label={label}
      multiple
      commitOnClose
      searchable
      searchPlaceholder="Search people…"
      options={options}
      value={value}
      onChange={onChange}
      loading={members.isFetching}
      emptyText="No one found"
      triggerClassName="px-1.5 py-1 text-sm text-text"
    >
      <Users aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
      <span className="truncate">{shown.length > 0 ? shown.join(', ') : 'Unassigned'}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
    </OptionPicker>
  );
}
