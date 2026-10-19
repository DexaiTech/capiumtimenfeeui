import { Button, EmptyState } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

import type { ReratePreview } from '../../types';
import { plural } from '../../utils/format';
import { formatDelta, skipSummary } from '../../utils/rerate';
import { EntryTable, type EntryRow } from './EntryTable';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-surface px-4 py-3">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="text-xl font-semibold text-text tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-text-muted">{hint}</dd> : null}
    </div>
  );
}

export interface PreviewResultProps {
  preview: ReratePreview;
  /** Show the cost values (the person holds `rate.read`). */
  showCost: boolean;
  onApply: () => void;
}

/** Step 2 of a re-rate: what it would do. Nothing has been changed; applying is a separate step. */
export function PreviewResult({ preview, showCost, onApply }: PreviewResultProps) {
  const { totals } = preview;
  const rows: EntryRow[] = preview.items.map((entry) => ({ key: entry.entry_id, ...entry }));
  const costKnown = totals.cost_value_before !== null && totals.cost_value_after !== null;
  const nothing = totals.entries_to_change === 0;
  const left = skipSummary(preview.skipped);

  return (
    <section aria-labelledby="rerate-preview" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="rerate-preview" className="text-base font-semibold text-text">
            Preview
          </h2>
          <p className="text-sm text-text-muted">
            Nothing has been changed yet. Review what would happen, then apply it.
          </p>
        </div>
        <Button variant="primary" onClick={onApply} disabled={nothing}>
          Apply re-rate
        </Button>
      </div>
      <dl
        className={cn(
          'grid gap-3 sm:grid-cols-2',
          showCost && costKnown ? 'xl:grid-cols-5' : 'xl:grid-cols-4',
        )}
      >
        <Stat
          label="Entries to change"
          value={String(totals.entries_to_change)}
          hint={`of ${plural(totals.entries_examined, 'unbilled entry', 'unbilled entries')} looked at`}
        />
        <Stat
          label="Unchanged"
          value={String(totals.entries_unchanged)}
          hint="Already at the right rate"
        />
        <Stat
          label="Left alone"
          value={String(totals.entries_skipped)}
          hint={left || 'Nothing is billed, drafted, written off or locked'}
        />
        <Stat
          label="Charge-out value"
          value={formatMoney(totals.charge_value_after)}
          hint={`Was ${formatMoney(totals.charge_value_before)} (${formatDelta(totals.charge_value_delta)})`}
        />
        {showCost && costKnown ? (
          <Stat
            label="Cost value"
            value={formatMoney(totals.cost_value_after)}
            hint={`Was ${formatMoney(totals.cost_value_before)} (${formatDelta(totals.cost_value_delta)})`}
          />
        ) : null}
      </dl>
      <p className="text-sm text-text-muted">
        Only unbilled time is re-priced. Billed, drafted and written-off time and locked periods are
        always left alone.
      </p>
      <EntryTable
        caption="Entries in the preview"
        rows={rows}
        showCost={showCost}
        tense="preview"
        empty={
          <EmptyState
            title="No entries would change"
            description="Every unbilled entry in this scope already has the rate it would get today, or is left alone."
          />
        }
        footer={
          preview.items_truncated ? (
            <p className="border-t border-row-border px-4 py-3 text-sm text-text-muted">
              Showing the first {rows.length} entries. The totals above cover all{' '}
              {plural(totals.entries_examined, 'unbilled entry', 'unbilled entries')} looked at.
            </p>
          ) : null
        }
      />
    </section>
  );
}
