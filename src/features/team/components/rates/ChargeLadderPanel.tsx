import { ChevronDown } from 'lucide-react';

import { CHARGE_LADDER } from '../../constants';

/**
 * The order in which the charge-out rate of a time entry is chosen, as text: the first level
 * that has a rate in force wins, and the practice default is the last resort. Nothing here is
 * editable; the rates themselves are in the list below it.
 */
export function ChargeLadderPanel() {
  return (
    <details open className="group rounded-xl border border-border bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold text-text">
            How the charge-out rate is chosen
          </span>
          <span className="text-sm text-text-muted">
            The first rate that applies on the day of the entry wins, from the most specific level
            to the least.
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-text-muted transition-transform duration-fast ease-standard group-open:rotate-180"
        />
      </summary>
      <ol
        aria-label="Charge-out rate levels"
        className="grid gap-x-8 gap-y-3 border-t border-row-border px-5 py-4 md:grid-cols-2"
      >
        {CHARGE_LADDER.map((level) => (
          <li key={level.position} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-text"
            >
              {level.position}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-text">{level.title}</span>
              <span className="text-xs text-text-muted">{level.help}</span>
            </div>
          </li>
        ))}
        <li className="flex gap-3">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-badge-grey-soft text-xs font-semibold text-badge-grey"
          >
            {CHARGE_LADDER.length + 1}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium text-text">Practice default</span>
            <span className="text-xs text-text-muted">
              The practice’s default charge-out rate, when nothing above applies.
            </span>
          </div>
        </li>
      </ol>
    </details>
  );
}
