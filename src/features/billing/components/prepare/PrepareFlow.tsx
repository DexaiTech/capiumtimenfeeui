import { useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import { useClientBilling, useClientBillingSummary, useClientWip, useVatOptions } from '../../api';
import type { BillingBasis, GroupBy } from '../../types';
import { basisEdits } from '../../utils/basis';
import {
  overridesOf,
  planLines,
  previewLines,
  previewTotals,
  selectionOf,
  type LineEdit,
  type LineEdits,
  type PreviewLine,
} from '../../utils/prepare';
import { chosenItems, fixedFeesOf, workRowsOf } from '../../utils/workRows';
import { LoadError } from '../PageShell';
import { DetailsStep } from './DetailsStep';
import { LineEditDialog } from './LineEditDialog';
import { ReviewStep } from './ReviewStep';
import { BillingSummary } from './BillingSummary';
import { Steps, type PrepareStep } from './Steps';
import { WorkStep } from './WorkStep';

/** Preparing one client's invoice: choose the work, review the lines, set the dates, make the draft. */
export function PrepareFlow({
  clientId,
  preselect = [],
}: {
  clientId: string;
  /** Time entries to have chosen when the work is listed (time picked on the Time Entries page). */
  preselect?: ReadonlyArray<string>;
}) {
  const { organization } = useOrg();
  const wip = useClientWip(clientId, null);
  const billing = useClientBilling(clientId);
  const summary = useClientBillingSummary(clientId);
  const vat = useVatOptions();
  const [step, setStep] = useState<PrepareStep>('work');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>('job');
  const [basis, setBasis] = useState<BillingBasis>('contract');
  const [edits, setEdits] = useState<LineEdits>({});
  const [editing, setEditing] = useState<PreviewLine | null>(null);
  const currency = organization.currency;

  // Time picked on another page is chosen once, when the work first arrives.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !wip.data || preselect.length === 0) return;
    preselected.current = true;
    const wanted = new Set(preselect);
    const { rows: available } = workRowsOf(wip.data.items);
    setSelected(
      new Set(
        available.filter((row) => row.ids.some((id) => wanted.has(id))).map((row) => row.key),
      ),
    );
  }, [wip.data, preselect]);

  if (wip.isError) {
    return (
      <LoadError
        title="Could not load the work in progress"
        error={wip.error}
        onRetry={() => void wip.refetch()}
        retrying={wip.isRefetching}
      />
    );
  }
  if (!wip.data || vat.isPending || billing.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading the work in progress">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { rows, blocked } = workRowsOf(wip.data.items);
  const items = chosenItems(wip.data.items, rows, selected);
  const planned = planLines(items, groupBy, fixedFeesOf(rows, selected));
  // What the chosen basis bills; the person's own edits of a line win over it.
  const allEdits: LineEdits = { ...basisEdits(basis, planned, summary.data), ...edits };
  const lines = previewLines(planned, allEdits, {
    options: vat.options,
    defaultId:
      billing.data?.default_vat_rate_id ??
      vat.options.find((option) => option.is_default)?.id ??
      null,
  });
  const totals = previewTotals(lines);
  const groupable = items.some(
    (item) => item.kind === 'time' && item.job?.billing_basis !== 'fixed',
  );

  const choose = (next: ReadonlySet<string>) => {
    setSelected(next);
    // Another choice makes other lines: what was edited no longer applies.
    setEdits({});
  };
  const chooseBasis = (next: BillingBasis) => {
    setBasis(next);
    // The job's value is set per job: lines grouped by job are the ones it applies to.
    if (next === 'job') setGroupBy('job');
    setEdits({});
  };
  const edit = (key: string, change: LineEdit | undefined) =>
    setEdits((current) => ({ ...current, [key]: change }));

  return (
    <div className="flex flex-col gap-4">
      <Steps current={step} />

      {summary.data ? (
        <BillingSummary summary={summary.data} basis={basis} onBasisChange={chooseBasis} />
      ) : null}

      {step === 'work' ? (
        <WorkStep
          wip={wip.data}
          rows={rows}
          blocked={blocked}
          selected={selected}
          onSelectedChange={choose}
          onContinue={() => setStep('review')}
        />
      ) : null}

      {step === 'review' ? (
        <>
          <ReviewStep
            lines={lines}
            totals={totals}
            edits={allEdits}
            currency={currency}
            groupBy={groupBy}
            onGroupByChange={(next) => {
              setGroupBy(next);
              setEdits({});
            }}
            groupable={groupable}
            onEdit={setEditing}
            onReset={(key) => edit(key, undefined)}
            onBack={() => setStep('work')}
            onContinue={() => setStep('details')}
          />
          <LineEditDialog
            line={editing}
            vatOptions={vat.options}
            currency={currency}
            onClose={() => setEditing(null)}
            onSave={edit}
          />
        </>
      ) : null}

      {step === 'details' ? (
        <DetailsStep
          clientName={wip.data.client.name}
          invoiceEmail={billing.data?.invoice_email ?? ''}
          termsDays={billing.data?.payment_terms_days ?? organization.payment_terms_days}
          itemCount={items.length}
          totals={totals}
          buildRequest={(header) => ({
            client_id: clientId,
            ...selectionOf(items),
            group_by: groupBy,
            overrides: overridesOf(planned, allEdits),
            ...header,
          })}
          onBack={() => setStep('review')}
        />
      ) : null}
    </div>
  );
}
