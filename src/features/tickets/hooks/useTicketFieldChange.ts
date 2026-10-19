import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui';

import { useUpdateTicket } from '../api';
import { PRIORITY_META, STATUS_META } from '../constants';
import type { TicketListItem, TicketPriority, TicketStatus } from '../types';
import { describeFailure } from '../utils/errors';

export type FieldChange = { status: TicketStatus } | { priority: TicketPriority };

/**
 * An inline change of a ticket's status or priority (the select pills): applied at once, put back
 * with a toast when the API refuses it. `announcement` is the sentence for a polite live region,
 * so a screen reader hears the result as well.
 */
export function useTicketFieldChange() {
  const { mutate } = useUpdateTicket();
  const { toast } = useToast();
  const [announcement, setAnnouncement] = useState('');

  const change = useCallback(
    (ticket: Pick<TicketListItem, 'id' | 'code'>, next: FieldChange) => {
      const what =
        'status' in next
          ? `Status of ${ticket.code} set to ${STATUS_META[next.status].label}`
          : `Priority of ${ticket.code} set to ${PRIORITY_META[next.priority].label}`;
      mutate(
        { ticketId: ticket.id, body: next },
        {
          onSuccess: () => setAnnouncement(what),
          onError: (error) => {
            const notice = describeFailure(error, `Could not change ${ticket.code}`);
            setAnnouncement(`${notice.title}. The change to ${ticket.code} was undone.`);
            toast({ tone: 'error', ...notice });
          },
        },
      );
    },
    [mutate, toast],
  );

  return { change, announcement };
}
