import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Skeleton } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { parsePounds, penceToPoundsInput } from '@/utils/money';

import {
  useClientBilling,
  useClientBillingSummary,
  useClientWip,
  useServiceOptions,
  useVatOptions,
} from '../../api';
import { WIP_KIND_LABELS } from '../../constants';
import {
  prepareLinesSchema,
  type GridLineValues,
  type PrepareLinesValues,
} from '../../schemas/forms';
import type { BillingBasis, GroupBy, InvoiceLineCreate } from '../../types';
import { basisEdits } from '../../utils/basis';
import {
  FIRST_DESCRIPTION,
  gridTotals,
  newGridLine,
  type LineGridMeta,
} from '../../utils/lineGrid';
import { formatQuantity, parseQuantity } from '../../utils/lineMaths';
import {
  overridesOf,
  planLines,
  previewLines,
  selectionOf,
  type LineEdit,
  type LineEdits,
  type PreviewLine,
  type VatDefaults,
} from '../../utils/prepare';
import { chosenItems, fixedFeesOf, workRowsOf } from '../../utils/workRows';
import { LoadError } from '../PageShell';
import { DetailsStep } from './DetailsStep';
import { ReviewStep } from './ReviewStep';
import { BillingSummary } from './BillingSummary';
import { Steps, type PrepareStep } from './Steps';
import { WorkStep } from './WorkStep';

/** A line of the chosen work as a row of the grid: what it bills is typed as its net. */
function workRow(line: PreviewLine): GridLineValues {
  return {
    key: line.key,
    wip: true,
    description: line.text,
    quantity: '',
    unit_amount: '',
    net_amount: line.billed === null ? '' : penceToPoundsInput(line.billed),
    vat_rate_id: line.vatRateId ?? '',
    service_id: '',
  };
}

function workMeta(line: PreviewLine): LineGridMeta {
  const kind = WIP_KIND_LABELS[line.kind];
  const time = line.kind === 'time';
  return {
    label: { text: kind.label, tone: kind.tone },
    quantity: time && line.quantity !== null ? formatQuantity(line.quantity) : null,
    unitAmount: time ? line.unitAmount : null,
    wip: line.wip,
    net: line.net,
    defaultVat: line.vatDefault,
  };
}

/** What the rows of work say, as the edits `overridesOf` sends only where they differ. */
function editsOf(lines: ReadonlyArray<GridLineValues>): LineEdits {
  const edits: Record<string, LineEdit> = {};
  for (const line of lines) {
    if (!line.wip) continue;
    const net = line.net_amount.trim() === '' ? null : parsePounds(line.net_amount);
    edits[line.key] = {
      ...(net === null ? {} : { net }),
      description: line.description.trim(),
      ...(line.vat_rate_id ? { vatRateId: line.vat_rate_id } : {}),
    };
  }
  return edits;
}

/** The rows typed in, as the API's `manual_lines`; fees in advance when the box is ticked. */
function manualLinesOf({ advance, lines }: PrepareLinesValues): InvoiceLineCreate[] {
  return lines.flatMap((line) => {
    const quantity = parseQuantity(line.quantity);
    const unit = parsePounds(line.unit_amount);
    if (line.wip || quantity === null || unit === null) return [];
    return [
      {
        description: line.description.trim(),
        quantity: formatQuantity(quantity),
        unit_amount: unit,
        ...(line.vat_rate_id ? { vat_rate_id: line.vat_rate_id } : {}),
        ...(line.service_id ? { service_id: line.service_id } : {}),
        ...(advance ? { is_advance: true } : {}),
      },
    ];
  });
}

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
  const services = useServiceOptions();
  const [step, setStep] = useState<PrepareStep>('work');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>('job');
  const [basis, setBasis] = useState<BillingBasis>('contract');
  const form = useForm<PrepareLinesValues>({
    resolver: zodResolver(prepareLinesSchema),
    defaultValues: { advance: true, lines: [] },
  });
  // "Fees in advance" ticked or unticked by the person stays; else it follows the work chosen.
  const advanceChosen = useRef(false);
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

  const ready = wip.data !== undefined && !vat.isPending && !billing.isPending;
  const { rows, blocked } = workRowsOf(wip.data?.items ?? []);
  const items = chosenItems(wip.data?.items ?? [], rows, selected);
  const planned = planLines(
    items,
    groupBy,
    fixedFeesOf(rows, selected),
    wip.data?.default_vat ?? null,
  );
  const vatDefaults: VatDefaults = {
    options: vat.options,
    clientId: billing.data?.default_vat_rate_id ?? null,
    practiceId: vat.options.find((option) => option.is_default)?.id ?? null,
    registered: organization.vat_registered,
  };
  // The lines of the work as the chosen basis bills them, before the person changes any.
  const lines = previewLines(planned, basisEdits(basis, planned, summary.data), vatDefaults);
  const drafted = new Map(lines.map((line) => [line.key, workRow(line)]));
  const metas = new Map(lines.map((line) => [line.key, workMeta(line)]));
  const signature = ready ? JSON.stringify([...drafted.values()]) : null;

  // Other work, grouping or basis makes other lines of work: what was typed on the old ones no
  // longer applies. The lines typed in stay.
  useEffect(() => {
    if (signature === null) return;
    const work = JSON.parse(signature) as GridLineValues[];
    const { advance, lines: current } = form.getValues();
    form.reset({
      advance: advanceChosen.current ? advance : work.length === 0,
      lines: [...work, ...current.filter((line) => !line.wip)],
    });
  }, [signature, form]);

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
  if (!wip.data || !ready) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading the work in progress">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const groupable = items.some(
    (item) => item.kind === 'time' && item.job?.billing_basis !== 'fixed',
  );
  const typedIn = form.getValues('lines').some((line) => !line.wip);

  const chooseBasis = (next: BillingBasis) => {
    setBasis(next);
    // The job's value is set per job: lines grouped by job are the ones it applies to.
    if (next === 'job') setGroupBy('job');
  };
  // Fees billed in advance: a line typed in, to which time is assigned once the invoice is issued.
  const billInAdvance = () => {
    if (!typedIn) {
      form.setValue('lines', [...form.getValues('lines'), newGridLine(FIRST_DESCRIPTION)]);
    }
    form.setValue('advance', true);
    advanceChosen.current = true;
    setStep('review');
  };

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
          onSelectedChange={setSelected}
          hasLines={typedIn}
          onContinue={() => setStep('review')}
          onAdvance={billInAdvance}
        />
      ) : null}

      {step === 'review' ? (
        <ReviewStep
          form={form}
          metas={metas}
          drafted={drafted}
          vat={vatDefaults}
          currency={currency}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          groupable={groupable}
          onAdvanceChosen={() => {
            advanceChosen.current = true;
          }}
          onBack={() => setStep('work')}
          onContinue={() => setStep('details')}
        />
      ) : null}

      {step === 'details' ? (
        <DetailsStep
          clientName={wip.data.client.name}
          invoiceEmail={billing.data?.invoice_email ?? ''}
          termsDays={billing.data?.payment_terms_days ?? organization.payment_terms_days}
          lineCount={form.getValues('lines').length}
          totals={gridTotals(form.getValues('lines'), metas, vatDefaults, services)}
          buildRequest={(header) => {
            const values = form.getValues();
            const manual = manualLinesOf(values);
            return {
              client_id: clientId,
              ...selectionOf(items),
              group_by: groupBy,
              overrides: overridesOf(planned, editsOf(values.lines)),
              valuation_basis: basis,
              ...(manual.length > 0 ? { manual_lines: manual } : {}),
              ...header,
            };
          }}
          onBack={() => setStep('review')}
        />
      ) : null}
    </div>
  );
}
