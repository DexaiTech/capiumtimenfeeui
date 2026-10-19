import { Banknote, ListChecks, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Button,
  Card,
  ColumnVisibilityMenu,
  DataTable,
  EmptyState,
  PageToolbar,
  Select,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import type { ClientWip } from '../../types';
import { dateCell, plural } from '../../utils/format';
import { chosenValue, type BlockedItem, type WorkRow } from '../../utils/workRows';
import { workColumns } from './workColumns';

const ALL_JOBS = '';

export interface WorkStepProps {
  wip: ClientWip;
  rows: WorkRow[];
  blocked: BlockedItem[];
  selected: ReadonlySet<string>;
  onSelectedChange: (selected: ReadonlySet<string>) => void;
  onContinue: () => void;
}

/** Step one: tick the time, disbursements and fixed fees of the client to put on the invoice. */
export function WorkStep({
  wip,
  rows,
  blocked,
  selected,
  onSelectedChange,
  onContinue,
}: WorkStepProps) {
  const { organization } = useOrg();
  const currency = organization.currency;
  const [jobId, setJobId] = useState(ALL_JOBS);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const columns = useMemo(() => workColumns(currency), [currency]);

  const jobs = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (row.item.job) byId.set(row.item.job.id, row.item.job.name);
    }
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const visible = jobId === ALL_JOBS ? rows : rows.filter((row) => row.item.job?.id === jobId);

  const chosen = rows.filter((row) => selected.has(row.key));
  const total = chosenValue(rows, selected);
  const fixedChosen = chosen.some(
    (row) => row.kind === 'fixed_fee' || row.item.job?.billing_basis === 'fixed',
  );

  // The table only knows the rows on show: what is chosen out of sight stays chosen.
  const change = (next: ReadonlySet<string>) => {
    const onShow = new Set(visible.map((row) => row.key));
    const kept = [...selected].filter((key) => !onShow.has(key));
    onSelectedChange(new Set([...kept, ...next]));
  };

  const totals = wip.totals;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted" aria-live="polite">
        {wip.client.name} has {formatMoney(totals.total, currency)} of work in progress:{' '}
        {totals.hours} hours of time ({formatMoney(totals.time_value, currency)}) and{' '}
        {formatMoney(totals.disbursement_value, currency)} of disbursements.
      </p>

      <DataTable
        caption={`Work in progress of ${wip.client.name}`}
        columns={columns}
        rows={visible}
        rowKey={(row) => row.key}
        selectable
        selected={selected}
        onSelectedChange={change}
        selectLabel={(row) =>
          `Select ${row.kind === 'fixed_fee' ? 'the fixed fee of ' : ''}${row.item.job?.name ?? 'work'}, ${dateCell(row.item.date)}`
        }
        hiddenColumns={hidden}
        toolbar={
          <PageToolbar
            start={
              jobs.length > 1 ? (
                <div className="w-56 max-w-full">
                  <Select
                    label="Job"
                    hideLabel
                    options={[
                      { value: ALL_JOBS, label: 'All jobs' },
                      ...jobs.map(([id, name]) => ({ value: id, label: name })),
                    ]}
                    value={jobId}
                    onChange={(event) => setJobId(event.target.value)}
                  />
                </div>
              ) : undefined
            }
            actions={
              <ColumnVisibilityMenu
                columns={columns.map((column) => ({
                  id: column.id,
                  label: column.header,
                  locked: column.hideable === false,
                }))}
                hidden={hidden}
                onChange={setHidden}
              />
            }
          />
        }
        empty={
          jobId === ALL_JOBS ? (
            <EmptyState
              icon={<Banknote className="size-6" />}
              title="Nothing to bill"
              description="This client has no unbilled time, disbursements or fixed fees that can be invoiced."
            />
          ) : (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No work on this job"
              description="Choose another job, or all of them."
              action={<Button onClick={() => setJobId(ALL_JOBS)}>All jobs</Button>}
            />
          )
        }
      />

      {blocked.length > 0 ? (
        <Card padding="sm">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-text">
              {plural(blocked.length, 'item', 'items')} in work in progress cannot be invoiced yet
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-text-muted">
              {blocked.map(({ item, reason }) => (
                <li key={item.id} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    {item.description ?? item.job?.name ?? 'Item'} ({reason})
                  </span>
                  <span className="tabular-nums">{formatMoney(item.value, currency)}</span>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}

      <Card padding="sm" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text" aria-live="polite">
            {chosen.length === 0
              ? 'Nothing chosen yet.'
              : `${plural(chosen.length, 'item', 'items')} chosen, ${formatMoney(total, currency)} of work in progress.`}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={chosen.length === 0}
              onClick={() => onSelectedChange(new Set())}
            >
              Clear choice
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<ListChecks aria-hidden="true" className="size-4" />}
              disabled={chosen.length === 0}
              onClick={onContinue}
            >
              Review the lines
            </Button>
          </div>
        </div>
        {fixedChosen ? (
          <p className="text-xs text-text-muted">
            Choosing time on a fixed-fee job bills the job's fixed fee less what is already billed,
            not the time.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
