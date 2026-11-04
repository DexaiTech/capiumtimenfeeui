import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { parsePounds, penceToPoundsInput } from '@/utils/money';

import { useClientBilling, useSaveInvoiceLines, useServiceOptions, useVatOptions } from '../../api';
import { WIP_KIND_LABELS } from '../../constants';
import { draftLinesSchema, type DraftLinesValues, type GridLineValues } from '../../schemas/forms';
import type {
  InvoiceDetail,
  InvoiceLine,
  InvoiceLineCreate,
  InvoiceLinesSave,
  InvoiceLineUpdate,
  ServiceOption,
} from '../../types';
import { toFormError } from '../../utils/errors';
import { plural } from '../../utils/format';
import type { LineGridMeta } from '../../utils/lineGrid';
import { formatQuantity, parseQuantity } from '../../utils/lineMaths';
import type { VatDefaults } from '../../utils/prepare';
import { LineGrid } from '../LineGrid';

/** A saved line as a row of the grid; a line of work bills what its net says. */
function rowOf(line: InvoiceLine): GridLineValues {
  return {
    key: line.id,
    wip: line.kind !== 'manual',
    description: line.description,
    quantity: line.quantity,
    unit_amount: penceToPoundsInput(line.unit_amount),
    net_amount: penceToPoundsInput(line.net_amount),
    vat_rate_id: line.vat_rate_id ?? '',
    service_id: line.service_id ?? '',
    advance: line.is_advance ?? false,
  };
}

const valuesOf = (lines: ReadonlyArray<InvoiceLine>): DraftLinesValues => ({
  lines: lines.map(rowOf),
});

function metaOf(line: InvoiceLine, services: ReadonlyArray<ServiceOption>): LineGridMeta {
  const work = line.kind === 'manual' ? null : WIP_KIND_LABELS[line.kind];
  return {
    label: line.is_advance
      ? { text: 'Fees in advance', tone: 'green' }
      : work
        ? { text: work.label, tone: work.tone }
        : undefined,
    note: line.wip
      ? `billed from ${plural(line.wip.item_count, 'WIP item', 'WIP items')}`
      : undefined,
    quantity: line.quantity,
    unitAmount: line.unit_amount,
    ...(work && line.wip ? { wip: line.wip.wip_value } : {}),
    serviceName: services.find((service) => service.id === line.service_id)?.name ?? null,
    savedVat: line.vat_rate_id ? { id: line.vat_rate_id, rate_bp: line.vat_rate_bp } : null,
  };
}

/**
 * What changed on a saved line: a line of work changes its wording, the amount it bills and its
 * VAT code; a line typed in also its quantity, unit price and whether it is fees in advance.
 */
function changesOf(line: InvoiceLine, row: GridLineValues): InvoiceLineUpdate {
  const changes: InvoiceLineUpdate = {};
  const description = row.description.trim();
  if (description !== line.description) changes.description = description;
  if (row.wip) {
    const net = parsePounds(row.net_amount);
    if (net !== null && net !== line.net_amount) changes.net_amount = net;
  } else {
    const quantity = parseQuantity(row.quantity);
    const unit = parsePounds(row.unit_amount);
    if (quantity !== null && formatQuantity(quantity) !== line.quantity) {
      changes.quantity = formatQuantity(quantity);
    }
    if (unit !== null && unit !== line.unit_amount) changes.unit_amount = unit;
    if (row.advance !== (line.is_advance ?? false)) changes.is_advance = row.advance;
  }
  if (row.vat_rate_id !== (line.vat_rate_id ?? '')) changes.vat_rate_id = row.vat_rate_id || null;
  return changes;
}

export interface DraftLinesGridProps {
  invoice: InvoiceDetail;
  /** Told when the grid has changes not saved yet (the draft is issued as saved). */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * The lines of a draft in the line grid, edited in place: change a row, add one with "+ Row",
 * remove one with its bin, then "Save lines" saves every change in one request, all or nothing.
 * A removed line of work goes back to unbilled WIP.
 */
export function DraftLinesGrid({ invoice, onDirtyChange }: DraftLinesGridProps) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const vat = useVatOptions();
  const billing = useClientBilling(invoice.client?.id ?? null);
  const services = useServiceOptions();
  const saveLines = useSaveInvoiceLines(invoice.id);
  const form = useForm<DraftLinesValues>({
    resolver: zodResolver(draftLinesSchema),
    defaultValues: valuesOf(invoice.lines),
  });
  const {
    formState: { isDirty, isSubmitting },
  } = form;
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<DraftLinesValues>({ setError: form.setError, fields: ['lines'] });

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
  // Lines saved elsewhere (another tab, a refresh) show at once while nothing is being changed.
  const savedLines = JSON.stringify(invoice.lines);
  useEffect(() => {
    if (!isDirty) form.reset(valuesOf(JSON.parse(savedLines) as InvoiceLine[]));
  }, [savedLines, isDirty, form]);

  const vatDefaults: VatDefaults = {
    options: vat.options,
    clientId: billing.data?.default_vat_rate_id ?? null,
    practiceId: vat.options.find((option) => option.is_default)?.id ?? null,
    registered: organization.vat_registered,
  };
  const metas = new Map(invoice.lines.map((line) => [line.id, metaOf(line, services)]));

  const save = form.handleSubmit(async ({ lines }) => {
    clearSubmitError();
    const kept: InvoiceLinesSave['lines'] = [];
    const added: InvoiceLineCreate[] = [];
    for (const row of lines) {
      const line = invoice.lines.find((saved) => saved.id === row.key);
      if (line) {
        kept.push({ id: line.id, ...changesOf(line, row) });
        continue;
      }
      const quantity = parseQuantity(row.quantity);
      const unit = parsePounds(row.unit_amount);
      if (quantity === null || unit === null) continue;
      added.push({
        description: row.description.trim(),
        quantity: formatQuantity(quantity),
        unit_amount: unit,
        ...(row.vat_rate_id ? { vat_rate_id: row.vat_rate_id } : {}),
        ...(row.service_id ? { service_id: row.service_id } : {}),
        ...(row.advance ? { is_advance: true } : {}),
      });
    }
    let latest: InvoiceDetail;
    try {
      // One request, all or nothing: a saved line not listed is removed.
      latest = await saveLines.mutateAsync({ lines: kept, new_lines: added });
    } catch (error) {
      handleSubmitError(toFormError(error));
      return;
    }
    form.reset(valuesOf(latest.lines));
    toast({ tone: 'success', title: 'Lines saved' });
  });

  if (vat.isPending) return null;

  return (
    <form
      noValidate
      aria-label="Lines of the draft"
      onSubmit={(event) => void save(event)}
      className="flex flex-col gap-3"
    >
      <h2 className="px-2 text-sm font-semibold text-text">Lines</h2>
      <LineGrid
        form={form}
        caption="Invoice lines"
        currency={invoice.currency}
        vat={vatDefaults}
        metas={metas}
        amountRequired
      />
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {isDirty ? (
          <p className="text-xs text-text-muted sm:mr-auto" aria-live="polite">
            Changes not saved yet: the draft is issued as it is saved.
          </p>
        ) : null}
        <Button
          disabled={!isDirty || isSubmitting}
          onClick={() => {
            clearSubmitError();
            form.reset(valuesOf(invoice.lines));
          }}
        >
          Discard changes
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={!isDirty || retryIn > 0}
        >
          Save lines
        </Button>
      </div>
    </form>
  );
}
