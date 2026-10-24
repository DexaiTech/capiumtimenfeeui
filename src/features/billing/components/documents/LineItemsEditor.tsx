import { Plus, Trash2 } from 'lucide-react';
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from 'react-hook-form';

import { Button, Input } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { useVatOptions } from '../../api';
import { MAX_DOCUMENT_LINES } from '../../constants';
import type { DocumentLineValues } from '../../schemas/forms';
import { emptyLine, previewLines, previewTotals } from '../../utils/documentLines';
import { VatSelect } from '../VatSelect';

/** What a form must hold to use the editor: its lines. */
export interface WithLines {
  lines: DocumentLineValues[];
}

export interface LineItemsEditorProps<TForm extends FieldValues & WithLines> {
  control: Control<TForm>;
  register: UseFormRegister<TForm>;
  errors: FieldErrors<TForm>;
  currency: string;
  disabled?: boolean;
}

/**
 * The lines of an estimate or a recurring schedule: description, quantity, unit price and VAT
 * code of each, add and remove, and the totals as typed. The API calculates the stored figures;
 * a line left on "Default" VAT is added to the totals only once the API has priced it.
 */
export function LineItemsEditor<TForm extends FieldValues & WithLines>({
  control,
  register,
  errors,
  currency,
  disabled = false,
}: LineItemsEditorProps<TForm>) {
  // The editor only touches `lines`; the cast keeps callers free to pass their own form type.
  const lineControl = control as unknown as Control<WithLines>;
  const lineRegister = register as unknown as UseFormRegister<WithLines>;
  const lineErrors = errors as unknown as FieldErrors<WithLines>;
  const { fields, append, remove } = useFieldArray({ control: lineControl, name: 'lines' });
  const lines = useWatch({ control: lineControl, name: 'lines' });
  const { options } = useVatOptions();
  const previews = previewLines(lines, options);
  const totals = previewTotals(previews);
  const money = (pence: number) => formatMoney(pence, currency);
  const listError = lineErrors.lines?.root?.message ?? lineErrors.lines?.message;

  return (
    <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-text">Lines</legend>
      {fields.map((field, index) => {
        const rowErrors = lineErrors.lines?.[index];
        const preview = previews[index];
        const number = index + 1;
        return (
          <div
            key={field.id}
            role="group"
            aria-label={`Line ${number}`}
            className="flex flex-col gap-3 rounded-lg border border-border p-3"
          >
            <Input
              label="Description"
              required
              autoComplete="off"
              error={rowErrors?.description?.message}
              {...lineRegister(`lines.${index}.description`)}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Quantity"
                required
                inputMode="decimal"
                autoComplete="off"
                error={rowErrors?.quantity?.message}
                {...lineRegister(`lines.${index}.quantity`)}
              />
              <Input
                label="Unit price (£)"
                required
                inputMode="decimal"
                autoComplete="off"
                hint="Negative for a discount."
                error={rowErrors?.unit_amount?.message}
                {...lineRegister(`lines.${index}.unit_amount`)}
              />
              <VatSelect
                // The codes arrive after the form opens: mounting again once they are there
                // makes the select show the code the line already holds.
                key={options.length}
                options={options}
                defaultLabel="Default"
                error={rowErrors?.vat_rate_id?.message}
                {...lineRegister(`lines.${index}.vat_rate_id`)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p aria-live="polite" className="text-sm text-text-muted">
                {preview?.net === null || preview === undefined
                  ? 'Enter a quantity and a unit price to see the line total.'
                  : `Line total ${money(preview.net)} before VAT`}
              </p>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove line ${number}`}
                leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                Remove
              </Button>
            </div>
          </div>
        );
      })}
      {listError ? (
        <p role="alert" className="text-xs text-danger">
          {listError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button
          size="sm"
          leftIcon={<Plus aria-hidden="true" className="size-4" />}
          disabled={fields.length >= MAX_DOCUMENT_LINES}
          onClick={() => append(emptyLine())}
        >
          Add a line
        </Button>
        <dl
          aria-label="Totals"
          className="grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-sm tabular-nums"
        >
          <dt className="text-text-muted">Net</dt>
          <dd className="text-right">{money(totals.net)}</dd>
          <dt className="text-text-muted">VAT</dt>
          <dd className="text-right">{money(totals.vat)}</dd>
          <dt className="font-semibold text-text">Total</dt>
          <dd className="text-right font-semibold text-text">{money(totals.gross)}</dd>
        </dl>
      </div>
      {totals.vatPending ? (
        <p className="text-xs text-text-muted">
          Lines on the default VAT code are priced with VAT when the document is saved.
        </p>
      ) : null}
    </fieldset>
  );
}
