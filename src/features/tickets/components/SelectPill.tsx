import { ChevronDown, Flag } from 'lucide-react';

import { OptionPicker, type PickerOption } from '@/components/ui';
import { cn } from '@/utils/cn';

import {
  PRIORITY_META,
  STATUS_META,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type ToneClasses,
} from '../constants';
import type { TicketListItem, TicketPriority, TicketStatus } from '../types';

interface PillOption<TValue extends string> {
  value: TValue;
  label: string;
  tone: ToneClasses;
}

interface SelectPillProps<TValue extends string> {
  /** The field and the ticket for assistive technology, for example "Status of APT271". */
  name: string;
  value: TValue;
  options: ReadonlyArray<PillOption<TValue>>;
  onChange: (value: TValue) => void;
  /** False for a person who may not change it: a plain pill without a menu. */
  editable: boolean;
  /** A coloured dot (a status) or a flag (a priority) before the text. */
  lead: 'dot' | 'flag';
  size?: 'sm' | 'md';
}

/**
 * The coloured text on a tint with a chevron that opens the menu of choices (the listbox
 * pattern: arrow keys, Enter, Escape). The text says the value; the colour only backs it up.
 */
function SelectPill<TValue extends string>({
  name,
  value,
  options,
  onChange,
  editable,
  lead,
  size = 'sm',
}: SelectPillProps<TValue>) {
  const current = options.find((option) => option.value === value);
  if (!current) return null;

  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'h-6 px-2.5 text-2xs' : 'h-8 px-3 text-xs',
        current.tone.soft,
        current.tone.text,
      )}
    >
      {lead === 'dot' ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : (
        <Flag aria-hidden="true" className="size-3 shrink-0" />
      )}
      {current.label}
      {editable ? <ChevronDown aria-hidden="true" className="size-3 shrink-0" /> : null}
    </span>
  );
  if (!editable) return pill;

  const choices: PickerOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    icon:
      lead === 'dot' ? (
        <span
          aria-hidden="true"
          className={cn('size-2 rounded-full bg-current', option.tone.text)}
        />
      ) : (
        <Flag aria-hidden="true" className={cn('size-3.5', option.tone.text)} />
      ),
  }));

  return (
    <OptionPicker
      label={`${name}: ${current.label}`}
      options={choices}
      value={[value]}
      onChange={([next]) => {
        const chosen = options.find((option) => option.value === next);
        if (chosen) onChange(chosen.value);
      }}
      triggerClassName="rounded-full! enabled:hover:bg-transparent!"
    >
      {pill}
    </OptionPicker>
  );
}

const STATUS_OPTIONS: ReadonlyArray<PillOption<TicketStatus>> = TICKET_STATUSES.map((status) => ({
  value: status,
  label: STATUS_META[status].label,
  tone: STATUS_META[status].tone,
}));

const PRIORITY_OPTIONS: ReadonlyArray<PillOption<TicketPriority>> = TICKET_PRIORITIES.map(
  (priority) => ({
    value: priority,
    label: PRIORITY_META[priority].label,
    tone: PRIORITY_META[priority].tone,
  }),
);

export interface TicketSelectProps<TValue extends string> {
  ticket: Pick<TicketListItem, 'code'> & { status: TicketStatus; priority: TicketPriority };
  editable: boolean;
  onChange: (value: TValue) => void;
  size?: 'sm' | 'md';
}

/** The status of a ticket as a select pill: Open amber, Hold orange, In Progress cyan, Reopen red, Closed green. */
export function StatusSelect({
  ticket,
  editable,
  onChange,
  size,
}: TicketSelectProps<TicketStatus>) {
  return (
    <SelectPill
      name={`Status of ${ticket.code}`}
      value={ticket.status}
      options={STATUS_OPTIONS}
      onChange={onChange}
      editable={editable}
      lead="dot"
      size={size}
    />
  );
}

/** The priority of a ticket as a select pill with a flag: High red, Medium orange, Low green, Not Set grey. */
export function PrioritySelect({
  ticket,
  editable,
  onChange,
  size,
}: TicketSelectProps<TicketPriority>) {
  return (
    <SelectPill
      name={`Priority of ${ticket.code}`}
      value={ticket.priority}
      options={PRIORITY_OPTIONS}
      onChange={onChange}
      editable={editable}
      lead="flag"
      size={size}
    />
  );
}
