import { Card, CardHeader } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import type { InvoiceDetail } from '../../types';
import { timelineOf } from '../../utils/timeline';

/** The activity of an invoice as a vertical timeline. */
export function InvoiceTimeline({ invoice }: { invoice: InvoiceDetail }) {
  const { organization } = useOrg();
  const events = timelineOf(invoice, organization.timezone);
  return (
    <Card padding="none">
      <CardHeader title="Activity" />
      <ol aria-label="Invoice activity" className="flex flex-col gap-4 px-5 py-4">
        {events.map((event, index) => (
          <li key={`${event.at}-${index}`} className="flex gap-3">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-text">{event.title}</span>
              {event.detail ? <span className="text-xs text-text-muted">{event.detail}</span> : null}
              <span className="text-xs text-text-subtle">{event.when}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
