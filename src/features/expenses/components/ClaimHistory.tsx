import { CircleCheck, Pencil, Send, Undo2, Redo2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatUkDateTime } from '@/utils/dates';

import { EVENT_LABEL } from '../constants';
import type { ClaimEvent, ClaimEventAction } from '../types';

const ICONS: Record<ClaimEventAction, ReactNode> = {
  submitted: <Send aria-hidden="true" className="size-4" />,
  recalled: <Undo2 aria-hidden="true" className="size-4" />,
  approved: <CircleCheck aria-hidden="true" className="size-4" />,
  returned: <Redo2 aria-hidden="true" className="size-4" />,
  corrected: <Pencil aria-hidden="true" className="size-4" />,
};

const TONES: Record<ClaimEventAction, string> = {
  submitted: 'bg-badge-amber-soft text-badge-amber',
  recalled: 'bg-badge-grey-soft text-badge-grey',
  approved: 'bg-badge-green-soft text-badge-green',
  returned: 'bg-badge-red-soft text-badge-red',
  corrected: 'bg-badge-violet-soft text-badge-violet',
};

export interface ClaimHistoryProps {
  events: ReadonlyArray<ClaimEvent>;
  timeZone: string;
}

/** What happened to the claim and who did it, oldest first: the trail the claimant sees too. */
export function ClaimHistory({ events, timeZone }: ClaimHistoryProps) {
  if (events.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-text-muted">Nothing has happened to this claim yet.</p>
    );
  }
  return (
    <ol aria-label="History of the claim" className="flex flex-col gap-4 px-5 py-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span
            aria-hidden="true"
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONES[event.action]}`}
          >
            {ICONS[event.action]}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm text-text">
              <span className="font-semibold">{EVENT_LABEL[event.action]}</span> by{' '}
              {event.actor_name ?? 'someone'}
              <span className="text-text-muted">
                {' '}
                · {formatUkDateTime(event.created_at, timeZone)}
              </span>
            </p>
            {event.note ? (
              <p className="text-sm break-words whitespace-pre-line text-text-muted">
                {event.note}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
