import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFieldArray, useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form';

import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Input,
  Select,
  Textarea,
  type DataTableColumn,
} from '@/components/ui';
import { formatBasisPoints, formatMoney, penceToPoundsInput } from '@/utils/money';

import { useServiceOptions } from '../api';
import { MAX_DOCUMENT_LINES } from '../constants';
import type { GridLineValues } from '../schemas/forms';
import { defaultVatLabel } from '../utils/format';
import {
  FIRST_DESCRIPTION,
  gridTotals,
  newGridLine,
  priceGridLine,
  rowDefaultVat,
  vatNoteOf,
  type LineGridMeta,
  type LineGridMetas,
} from '../utils/lineGrid';
import { vatOn } from '../utils/lineMaths';
import type { PreviewTotals, VatDefaults } from '../utils/prepare';
import { VatSelect } from './VatSelect';

/** What a form must hold to use the grid: its lines. */
export interface WithGridLines {
  lines: GridLineValues[];
}

const NO_METAS: LineGridMetas = new Map();

export interface LineGridProps<TForm extends FieldValues & WithGridLines> {
  form: UseFormReturn<TForm>;
  /** Accessible name of the table. */
  caption: string;
  currency: string;
  /** The VAT codes, and the client's and the practice's default: what "Default" charges. */
  vat: VatDefaults;
  /** What is shown of each row besides what is typed, by the row's key. */
  metas?: LineGridMetas;
  /** Whether a row has a remove button (default: every row). */
  canRemove?: (line: GridLineValues) => boolean;
  /** More buttons of a row, before its remove button. */
  rowActions?: (index: number, line: GridLineValues) => ReactNode;
  /** Shown in the footer beside the totals. */
  summary?: (totals: PreviewTotals) => ReactNode;
  /** A row of work must say what it bills (a draft); else empty keeps what the work bills. */
  amountRequired?: boolean;
}

/** One row of the table: its place in the field array. */
interface Row {
  key: string;
  index: number;
}

/**
 * The lines of an invoice as a grid, edited in place: service, description, quantity, unit
 * price, VAT code, VAT and net of each row, whether a row typed in is fees in advance, "+ Row" to
 * add one, a bin to remove one, and the totals as typed. A row of work (`wip`) keeps the work's quantity and unit price; what it bills
 * is typed as its net, against what the work is worth. Used to create an invoice and to edit a
 * draft; the caller owns the form, checks it and saves it.
 */
export function LineGrid<TForm extends FieldValues & WithGridLines>({
  form: callerForm,
  caption,
  currency,
  vat,
  metas = NO_METAS,
  canRemove = () => true,
  rowActions,
  summary,
  amountRequired = false,
}: LineGridProps<TForm>) {
  // The grid only touches `lines`; the cast keeps callers free to pass their own form type.
  const form = callerForm as unknown as UseFormReturn<WithGridLines>;
  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitted },
  } = form;
  const services = useServiceOptions();
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const typed = useWatch({ control, name: 'lines' });
  const money = (pence: number) => formatMoney(pence, currency);
  const lineErrors = errors.lines;
  const listError = lineErrors?.root?.message ?? lineErrors?.message;

  const lineAt = (index: number): GridLineValues => typed[index] ?? newGridLine();
  const metaAt = (index: number): LineGridMeta | undefined => metas.get(lineAt(index).key);
  const priced = fields.map((_, index) =>
    priceGridLine(lineAt(index), metaAt(index), vat, services),
  );
  const totals = gridTotals(typed, metas, vat, services);

  const serviceOf = (id: string | undefined) => services.find((service) => service.id === id);
  // What a service puts on a line: its invoice wording, else its name.
  const wordingOf = (id: string | undefined) => {
    const service = serviceOf(id);
    return service ? service.invoice_description || service.name : undefined;
  };
  const feeOf = (id: string | undefined) => {
    const fee = serviceOf(id)?.default_fee;
    return fee === null || fee === undefined ? null : penceToPoundsInput(fee);
  };

  // A service chosen for a row words it and prices it, unless the person already has.
  const chooseService = (index: number, previousId: string, serviceId: string) => {
    const chosen = serviceOf(serviceId);
    if (!chosen) return;
    const options = { shouldDirty: true, shouldValidate: isSubmitted };
    const { description, unit_amount } = getValues(`lines.${index}`);
    const words = description.trim();
    const previous = serviceOf(previousId);
    if (
      words === '' ||
      words === FIRST_DESCRIPTION ||
      words === previous?.name ||
      words === wordingOf(previousId)
    ) {
      setValue(`lines.${index}.description`, wordingOf(serviceId) ?? chosen.name, options);
    }
    const fee = feeOf(serviceId);
    if (fee !== null && (unit_amount.trim() === '' || unit_amount === feeOf(previousId))) {
      setValue(`lines.${index}.unit_amount`, fee, options);
    }
  };

  /** What a row of work bills against what the work is worth. */
  const workHint = (index: number): ReactNode => {
    const meta = metaAt(index);
    const net = priced[index]?.net ?? null;
    if (meta?.wip === undefined) return undefined;
    if (net === null) return 'Empty: the fixed fee less what is already billed.';
    const difference = net - meta.wip;
    return (
      <span>
        Work {money(meta.wip)}
        {difference === 0 ? null : (
          <span className={difference < 0 ? 'text-danger' : 'text-success'}>
            {difference < 0
              ? `, write-off ${money(-difference)}`
              : `, write-on ${money(difference)}`}
          </span>
        )}
      </span>
    );
  };

  const readOnly = (text: ReactNode) => <span className="tabular-nums text-text">{text}</span>;

  /** A row typed in is fees in advance when ticked: only a row of more than zero can be. */
  const advanceBox = (index: number) => {
    const net = priced[index]?.net ?? null;
    const allowed = net === null || net > 0;
    return (
      <Checkbox
        label="Fees in advance"
        aria-label={`Fees in advance on line ${index + 1}`}
        description={allowed ? undefined : 'Only a line of more than zero can be fees in advance'}
        // Ticked already, it can still be unticked.
        disabled={!allowed && !lineAt(index).advance}
        {...register(`lines.${index}.advance`)}
      />
    );
  };

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'service',
      header: 'Service',
      plain: true,
      className: 'w-44 min-w-36',
      cell: ({ index }) => {
        const line = lineAt(index);
        // A saved line or a line of work keeps its service.
        if (line.wip || line.key !== '') return readOnly(metaAt(index)?.serviceName ?? '—');
        const field = register(`lines.${index}.service_id`);
        return (
          <Select
            label={`Service of line ${index + 1}`}
            hideLabel
            options={[
              { value: '', label: 'None' },
              ...services.map((service) => ({ value: service.id, label: service.name })),
            ]}
            {...field}
            onChange={(event) => {
              const previousId = getValues(`lines.${index}.service_id`);
              void field.onChange(event);
              chooseService(index, previousId, event.target.value);
            }}
          />
        );
      },
    },
    {
      id: 'description',
      header: 'Description',
      plain: true,
      className: 'min-w-64',
      cell: ({ index }) => {
        const meta = metaAt(index);
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <Textarea
              label={`Description of line ${index + 1}`}
              hideLabel
              required
              rows={2}
              autoComplete="off"
              error={lineErrors?.[index]?.description?.message}
              {...register(`lines.${index}.description`)}
            />
            {meta?.label || meta?.note ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                {meta.label ? (
                  <Badge tone={meta.label.tone} size="sm">
                    {meta.label.text}
                  </Badge>
                ) : null}
                {meta.note ? <span>{meta.note}</span> : null}
              </div>
            ) : null}
            {lineAt(index).wip ? null : advanceBox(index)}
          </div>
        );
      },
    },
    {
      id: 'quantity',
      header: 'Qty',
      plain: true,
      className: 'w-24 min-w-20',
      cell: ({ index }) =>
        lineAt(index).wip ? (
          readOnly(metaAt(index)?.quantity ?? '—')
        ) : (
          <Input
            label={`Quantity of line ${index + 1}`}
            hideLabel
            required
            inputMode="decimal"
            autoComplete="off"
            error={lineErrors?.[index]?.quantity?.message}
            {...register(`lines.${index}.quantity`)}
          />
        ),
    },
    {
      id: 'unit',
      header: 'Unit price (£)',
      plain: true,
      className: 'w-36 min-w-28',
      cell: ({ index }) => {
        if (lineAt(index).wip) {
          const unit = metaAt(index)?.unitAmount;
          return readOnly(unit === null || unit === undefined ? '—' : money(unit));
        }
        return (
          <Input
            label={`Unit price of line ${index + 1}`}
            hideLabel
            required
            inputMode="decimal"
            autoComplete="off"
            error={lineErrors?.[index]?.unit_amount?.message}
            {...register(`lines.${index}.unit_amount`)}
          />
        );
      },
    },
    {
      id: 'vat_code',
      header: 'VAT code',
      plain: true,
      className: 'w-44 min-w-36',
      cell: ({ index }) => (
        <VatSelect
          label={`VAT code of line ${index + 1}`}
          hideLabel
          options={vat.options}
          defaultLabel={defaultVatLabel(
            rowDefaultVat(lineAt(index), metaAt(index), vat, services),
            vat.options,
          )}
          current={metaAt(index)?.savedVat ?? null}
          error={lineErrors?.[index]?.vat_rate_id?.message}
          {...register(`lines.${index}.vat_rate_id`)}
        />
      ),
    },
    {
      id: 'vat',
      header: 'VAT',
      plain: true,
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: ({ index }) => {
        const line = priced[index];
        if (!line) return '—';
        return (
          <div className="flex flex-col">
            <span>{line.net === null ? '—' : money(vatOn(line.net, line.vatBp))}</span>
            <span className="text-xs text-text-muted">{formatBasisPoints(line.vatBp)}</span>
            <span className="text-xs text-text-muted">
              {vatNoteOf(lineAt(index), metaAt(index), vat, services)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'net',
      header: 'Net',
      plain: true,
      align: 'end',
      className: 'min-w-36 font-semibold tabular-nums text-text',
      cell: ({ index }) => {
        if (lineAt(index).wip) {
          return (
            <Input
              label={`Amount to bill of line ${index + 1}`}
              hideLabel
              required={amountRequired}
              inputMode="decimal"
              autoComplete="off"
              hint={workHint(index)}
              error={lineErrors?.[index]?.net_amount?.message}
              {...register(`lines.${index}.net_amount`)}
            />
          );
        }
        const net = priced[index]?.net ?? null;
        return <span className="whitespace-nowrap">{net === null ? '—' : money(net)}</span>;
      },
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DataTable
        caption={caption}
        columns={columns}
        rows={fields.map((field, index) => ({ key: field.id, index }))}
        rowKey={(row) => row.key}
        rowActions={({ index }) => {
          const line = lineAt(index);
          const extra = rowActions?.(index, line) ?? null;
          const removable = canRemove(line);
          if (!extra && !removable) return null;
          return (
            <div className="flex items-center justify-end gap-1">
              {extra}
              {removable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </div>
          );
        }}
        footer={
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-row-border px-4 py-3">
            <Button
              size="sm"
              aria-label="Add row"
              leftIcon={<Plus aria-hidden="true" className="size-4" />}
              // The rows typed in are capped; the rows of work are as many as the work chosen.
              disabled={typed.filter((line) => !line.wip).length >= MAX_DOCUMENT_LINES}
              onClick={() => append(newGridLine())}
            >
              Row
            </Button>
            <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
              {summary?.(totals)}
              <dl aria-label="Totals" className="flex min-w-56 flex-col gap-1.5 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-text-muted">Net</dt>
                  <dd className="tabular-nums">{money(totals.net)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-text-muted">VAT</dt>
                  <dd className="tabular-nums">{money(totals.vat)}</dd>
                </div>
                <div className="flex justify-between gap-6 font-semibold text-text">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(totals.gross)}</dd>
                </div>
              </dl>
            </div>
          </div>
        }
      />
      {listError ? (
        <p role="alert" className="text-xs text-danger">
          {listError}
        </p>
      ) : null}
    </div>
  );
}
