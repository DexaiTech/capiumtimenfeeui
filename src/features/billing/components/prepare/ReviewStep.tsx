import { ArrowLeft, ArrowRight, Pencil, RotateCcw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  DataTable,
  Select,
  type DataTableColumn,
  RowActions,
} from '@/components/ui';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { GROUP_BY_OPTIONS, WIP_KIND_LABELS } from '../../constants';
import type { GroupBy } from '../../types';
import { formatQuantity } from '../../utils/lineMaths';
import type { LineEdits, PreviewLine, PreviewTotals } from '../../utils/prepare';
import { plural } from '../../utils/format';

function lineColumns(currency: string): DataTableColumn<PreviewLine>[] {
  const money = (pence: number) => (
    <span className="tabular-nums text-text">{formatMoney(pence, currency)}</span>
  );
  return [
    {
      id: 'description',
      header: 'Description',
      hideable: false,
      className: 'min-w-64 max-w-[28rem]',
      cell: (line) => (
        <div className="flex min-w-0 items-start gap-2">
          <Badge tone={WIP_KIND_LABELS[line.kind].tone} size="sm">
            {WIP_KIND_LABELS[line.kind].label}
          </Badge>
          <span className="min-w-0 text-text">{line.text}</span>
        </div>
      ),
    },
    {
      id: 'quantity',
      header: 'Hours',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (line) =>
        line.kind === 'time' && line.quantity !== null ? (
          <span className="tabular-nums text-text">{formatQuantity(line.quantity)}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
    {
      id: 'wip',
      header: 'Work in progress',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (line) => money(line.wip),
    },
    {
      id: 'billed',
      header: 'To bill',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (line) =>
        line.billed === null ? (
          <span className="text-xs text-text-muted">Set when the draft is made</span>
        ) : (
          <span className="font-medium tabular-nums text-text">
            {formatMoney(line.billed, currency)}
          </span>
        ),
    },
    {
      id: 'adjustment',
      header: 'Write-on / off',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (line) =>
        line.adjustment === null || line.adjustment === 0 ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span
            className={
              line.adjustment < 0 ? 'tabular-nums text-danger' : 'tabular-nums text-success'
            }
          >
            {formatMoney(line.adjustment, currency)}
          </span>
        ),
    },
    {
      id: 'vat',
      header: 'VAT',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (line) => (
        <span className="tabular-nums text-text">{formatBasisPoints(line.vatBp)}</span>
      ),
    },
  ];
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd
        className={
          strong
            ? 'text-base font-semibold tabular-nums text-text'
            : 'text-sm font-semibold tabular-nums text-text'
        }
      >
        {value}
      </dd>
    </div>
  );
}

export interface ReviewStepProps {
  lines: PreviewLine[];
  totals: PreviewTotals;
  edits: LineEdits;
  currency: string;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  /** Hourly time is chosen: how it is grouped matters. */
  groupable: boolean;
  onEdit: (line: PreviewLine) => void;
  onReset: (key: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

/** Step two: the lines the draft will have, the amounts they bill and what that writes on or off. */
export function ReviewStep({
  lines,
  totals,
  edits,
  currency,
  groupBy,
  onGroupByChange,
  groupable,
  onEdit,
  onReset,
  onBack,
  onContinue,
}: ReviewStepProps) {
  const columns = lineColumns(currency);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-text-muted">
          {plural(lines.length, 'line', 'lines')} will be drafted. Edit a line to change its
          wording, the amount it bills or its VAT code.
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

      <DataTable
        caption="Lines of the invoice"
        columns={columns}
        rows={lines}
        rowKey={(line) => line.key}
        rowActions={(line) => (
          <RowActions
            label={`Actions for ${line.text}`}
            items={[
              {
                id: 'edit',
                label: 'Edit the line',
                icon: <Pencil aria-hidden="true" className="size-4" />,
                onSelect: () => onEdit(line),
              },
              ...(edits[line.key]
                ? [
                    {
                      id: 'reset',
                      label: 'Undo the changes',
                      icon: <RotateCcw aria-hidden="true" className="size-4" />,
                      onSelect: () => onReset(line.key),
                    },
                  ]
                : []),
            ]}
          />
        )}
        onRowClick={onEdit}
      />

      <Card padding="sm" className="flex flex-col gap-3">
        <dl aria-label="Invoice totals" className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
          <Figure label="Net" value={formatMoney(totals.net, currency)} />
          <Figure label="VAT (estimate)" value={formatMoney(totals.vat, currency)} />
          <Figure label="Total" value={formatMoney(totals.gross, currency)} strong />
          <Figure label="Work in progress cleared" value={formatMoney(totals.wip, currency)} />
          <Figure
            label={
              totals.adjustment < 0
                ? 'Written off'
                : totals.adjustment > 0
                  ? 'Written on'
                  : 'Written on or off'
            }
            value={formatMoney(Math.abs(totals.adjustment), currency)}
          />
        </dl>
        {totals.unpriced > 0 ? (
          <p className="text-xs text-text-muted">
            {plural(totals.unpriced, 'line is', 'lines are')} priced when the draft is made: a fixed
            fee bills the fee less what is already billed of it, and is left out of these totals.
          </p>
        ) : null}
        <p className="text-xs text-text-muted">
          VAT follows each line's code, else the client's default; disbursements keep their own
          code, so the draft may differ slightly.
        </p>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button leftIcon={<ArrowLeft aria-hidden="true" className="size-4" />} onClick={onBack}>
          Back to the work
        </Button>
        <Button
          variant="primary"
          rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}
          onClick={onContinue}
        >
          Dates and notes
        </Button>
      </div>
    </div>
  );
}
