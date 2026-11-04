import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { useWatch, type UseFormReturn } from 'react-hook-form';

import { Button, Checkbox, Select } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { GROUP_BY_OPTIONS } from '../../constants';
import type { GridLineValues, PrepareLinesValues } from '../../schemas/forms';
import type { GroupBy } from '../../types';
import { plural } from '../../utils/format';
import type { LineGridMetas } from '../../utils/lineGrid';
import type { VatDefaults } from '../../utils/prepare';
import { LineGrid } from '../LineGrid';

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

const sameLine = (a: GridLineValues, b: GridLineValues) =>
  a.description === b.description &&
  a.net_amount === b.net_amount &&
  a.vat_rate_id === b.vat_rate_id;

export interface ReviewStepProps {
  form: UseFormReturn<PrepareLinesValues>;
  /** What the grid shows of the rows of work. */
  metas: LineGridMetas;
  /** The rows of work as they would be drafted, to undo a change. */
  drafted: ReadonlyMap<string, GridLineValues>;
  vat: VatDefaults;
  currency: string;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  /** Hourly time is chosen: how it is grouped matters. */
  groupable: boolean;
  /** The person ticked or unticked "Fees in advance": their choice stays. */
  onAdvanceChosen: () => void;
  onBack: () => void;
  onContinue: () => void;
}

/**
 * Step two: the lines the draft will have, in the line grid. A line of the chosen work bills
 * what is typed as its net (more writes the work on, less writes it off); "+ Row" adds lines
 * that bill no work, as fees in advance or not.
 */
export function ReviewStep({
  form,
  metas,
  drafted,
  vat,
  currency,
  groupBy,
  onGroupByChange,
  groupable,
  onAdvanceChosen,
  onBack,
  onContinue,
}: ReviewStepProps) {
  // Only what changes as rows come and go: typing in the grid does not redraw the step.
  const [lineCount, typedIn, unpriced] = useWatch({
    control: form.control,
    name: 'lines',
    compute: (lines) =>
      [
        lines.length,
        lines.filter((line) => !line.wip).length,
        // A fixed fee only the API can price yet.
        lines.some((line) => line.wip && metas.get(line.key)?.net === null),
      ] as const,
  });
  const money = (pence: number) => formatMoney(pence, currency);

  return (
    <form
      noValidate
      aria-label="Lines to draft"
      onSubmit={(event) => void form.handleSubmit(onContinue)(event)}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-text-muted">
          {plural(lineCount, 'line', 'lines')} will be drafted. Change the wording, the amount or
          the VAT code of a line in the grid; + Row adds a line that bills no work.
        </p>
        {groupable ? (
          <div className="w-60 max-w-full">
            <Select
              label="Group the time"
              options={GROUP_BY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={groupBy}
              onChange={(event) => onGroupByChange(event.target.value as GroupBy)}
            />
          </div>
        ) : null}
      </div>

      <LineGrid
        form={form}
        caption="Lines of the invoice"
        currency={currency}
        vat={vat}
        metas={metas}
        // A line of work leaves the invoice by going back and unticking the work.
        canRemove={(line) => !line.wip}
        rowActions={(index, line) => {
          const original = drafted.get(line.key);
          if (!line.wip || !original || sameLine(line, original)) return null;
          return (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Undo the changes of line ${index + 1}`}
              onClick={() => form.setValue(`lines.${index}`, original, { shouldDirty: true })}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </Button>
          );
        }}
        summary={(totals) =>
          totals.wip > 0 || totals.adjustment !== 0 ? (
            <dl aria-label="Work in progress" className="flex min-w-56 flex-col gap-1.5 text-sm">
              <Figure label="Work in progress cleared" value={money(totals.wip)} />
              <Figure
                label={
                  totals.adjustment < 0
                    ? 'Written off'
                    : totals.adjustment > 0
                      ? 'Written on'
                      : 'Written on or off'
                }
                value={money(Math.abs(totals.adjustment))}
              />
            </dl>
          ) : null
        }
      />

      {typedIn > 0 ? (
        <Checkbox
          label="Fees in advance"
          description="Time is assigned to the lines added here once the invoice is issued, and leaves WIP then. Untick it for an ordinary fee, a discount or a correction."
          {...form.register('advance', { onChange: onAdvanceChosen })}
        />
      ) : null}
      {unpriced ? (
        <p className="text-xs text-text-muted">
          A fixed fee left empty is priced when the draft is made: it bills the fee less what is
          already billed of it, and is left out of these totals.
        </p>
      ) : null}
      <p className="text-xs text-text-muted">
        VAT is the code chosen for a line, else the code the draft gives it (named under each rate):
        the client's own code, else the job's service's, else the practice default; a disbursement
        keeps its own code.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button leftIcon={<ArrowLeft aria-hidden="true" className="size-4" />} onClick={onBack}>
          Back to the work
        </Button>
        <Button
          type="submit"
          variant="primary"
          rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}
        >
          Dates and notes
        </Button>
      </div>
    </form>
  );
}
