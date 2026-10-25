import { useState } from 'react';

import { Skeleton } from '@/components/ui';
import { useOrg } from '@/features/organizations';

import { useClientBilling, useClientWip, useVatOptions } from '../../api';
import type { GroupBy } from '../../types';
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
import { Steps, type PrepareStep } from './Steps';
import { WorkStep } from './WorkStep';

/** Preparing one client's invoice: choose the work, review the lines, set the dates, make the draft. */
export function PrepareFlow({ clientId }: { clientId: string }) {
  const { organization } = useOrg();
  const wip = useClientWip(clientId, null);
  const billing = useClientBilling(clientId);
  const vat = useVatOptions();
  const [step, setStep] = useState<PrepareStep>('work');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>('job');
  const [edits, setEdits] = useState<LineEdits>({});
  const [editing, setEditing] = useState<PreviewLine | null>(null);
  const currency = organization.currency;

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
  const lines = previewLines(planned, edits, {
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
  const edit = (key: string, change: LineEdit | undefined) =>
    setEdits((current) => ({ ...current, [key]: change }));

  return (
    <div className="flex flex-col gap-4">
      <Steps current={step} />

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
            edits={edits}
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
            overrides: overridesOf(planned, edits),
            ...header,
          })}
          onBack={() => setStep('review')}
        />
      ) : null}
    </div>
  );
}
