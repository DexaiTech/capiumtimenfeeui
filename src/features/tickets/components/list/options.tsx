import { Flag } from 'lucide-react';

import type { PickerOption } from '@/components/ui';
import { cn } from '@/utils/cn';

import {
  PRIORITY_META,
  STATUS_META,
  TAG_DOTS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../constants';
import type { TicketTag } from '../../types';

/** The choices of the status filters and menus: a dot in the status colour, then the name. */
export const STATUS_PICKER_OPTIONS: PickerOption[] = TICKET_STATUSES.map((status) => ({
  value: status,
  label: STATUS_META[status].label,
  icon: (
    <span
      aria-hidden="true"
      className={cn('size-2 rounded-full bg-current', STATUS_META[status].tone.text)}
    />
  ),
}));

/** The choices of the priority filters and menus: a flag in the priority colour, then the name. */
export const PRIORITY_PICKER_OPTIONS: PickerOption[] = TICKET_PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_META[priority].label,
  icon: <Flag aria-hidden="true" className={cn('size-3.5', PRIORITY_META[priority].tone.text)} />,
}));

/** The practice's tags as choices: a dot in the tag's colour, then the name. */
export function tagPickerOptions(tags: ReadonlyArray<TicketTag>): PickerOption[] {
  return tags.map((tag) => ({
    value: tag.id,
    label: tag.name,
    icon: <span aria-hidden="true" className={cn('size-2.5 rounded-full', TAG_DOTS[tag.color])} />,
  }));
}
