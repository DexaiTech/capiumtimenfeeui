import { Lock } from 'lucide-react';

import { Badge, Button, FormPanel, RowActions } from '@/components/ui';
import { formatMinutes } from '@/utils/minutes';

import type { TimeEntry } from '../../types';
import { describeEntry } from '../../utils/format';
import { BillableBadge, BillingStatusBadge } from '../badges';
import type { EntryActions } from '../EntryActions';

export interface CellEntriesPanelProps {
  open: boolean;
  onClose: () => void;
  /** The row and the day, "Acme Ltd · J00001 Accounts · Preparation, Monday 12/10/2026". */
  title: string;
  /** The entries of the cell as they are now (empty once the last one is deleted). */
  entries: ReadonlyArray<TimeEntry>;
  actions: EntryActions;
}

/**
 * The time of one cell of the week, opened from its details icon: each entry with its description
 * and note, "Edit entry" (or "View entry" while it is locked) and "Delete entry", which asks first.
 * A locked entry says why under it, so nothing is tried that the API would refuse. The list follows
 * the week as it is read again, so a deleted or moved entry leaves it.
 */
export function CellEntriesPanel({
  open,
  onClose,
  title,
  entries,
  actions,
}: CellEntriesPanelProps) {
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={title}
      description={
        entries.length === 0
          ? 'No time left here.'
          : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}, ${formatMinutes(total)}`
      }
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-text-muted">The time of this day was deleted or moved.</p>
      ) : (
        <ul aria-label="Time entries" className="flex flex-col divide-y divide-row-border">
          {entries.map((entry) => {
            const reason = actions.lockReason(entry);
            return (
              <li
                key={entry.id}
                aria-label={describeEntry(entry)}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-text tabular-nums">
                      {formatMinutes(entry.minutes)}
                    </span>
                    <BillableBadge billable={entry.is_billable} />
                    {entry.is_overtime ? (
                      <Badge tone="warning" size="sm">
                        Overtime
                      </Badge>
                    ) : null}
                    {entry.billing_status !== 'unbilled' ? (
                      <BillingStatusBadge status={entry.billing_status} />
                    ) : null}
                  </span>
                  <p className="text-sm break-words text-text">
                    {entry.description ?? <span className="text-text-muted">No description</span>}
                  </p>
                  {entry.internal_note ? (
                    <p className="text-xs break-words text-text-muted">
                      Internal note: {entry.internal_note}
                    </p>
                  ) : null}
                  {reason ? (
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <Lock className="size-3" aria-hidden="true" />
                      Locked: {reason}.
                    </p>
                  ) : null}
                </div>
                <RowActions
                  label={`Actions for the entry of ${describeEntry(entry)}`}
                  items={actions.actionsOf(entry)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </FormPanel>
  );
}
