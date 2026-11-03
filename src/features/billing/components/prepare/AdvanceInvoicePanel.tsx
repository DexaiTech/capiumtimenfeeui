import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  DataTable,
  FormPanel,
  Input,
  Textarea,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { formatMoney, parsePounds } from '@/utils/money';

import { useCreateInvoice } from '../../api';
import { MAX_DOCUMENT_LINES } from '../../constants';
import { advanceSchema, type AdvanceValues } from '../../schemas/forms';
import { toFormError } from '../../utils/errors';
import { formatQuantity, lineNet, parseQuantity, sumPence, vatOn } from '../../utils/lineMaths';
import { vatRateOf, type VatDefaults } from '../../utils/prepare';
import { DialogActions } from '../DialogActions';
import { VatSelect } from '../VatSelect';

export interface AdvanceInvoicePanelProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  /** The VAT codes, and the client's and the practice's default: what "Default" charges. */
  vatDefaults: VatDefaults;
}

const newLine = (description = '') => ({
  description,
  quantity: '1',
  unit_amount: '',
  vat_rate_id: '',
});

/** One row of the grid: its place in the field array. */
interface Row {
  key: string;
  index: number;
}

function AdvanceForm({
  clientId,
  vatDefaults,
  onClose,
}: Omit<AdvanceInvoicePanelProps, 'open' | 'clientName'>) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const create = useCreateInvoice();
  const formId = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdvanceValues>({
    resolver: zodResolver(advanceSchema),
    defaultValues: { lines: [newLine('Fees in advance')] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const typed = useWatch({ control, name: 'lines' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<AdvanceValues>({ setError, fields: ['lines'] });
  const money = (pence: number) => formatMoney(pence, organization.currency);

  // Each line as typed: net = quantity x unit price, VAT rounded per line as the API does.
  const priced = fields.map((_, index) => {
    const line = typed[index];
    const quantity = parseQuantity(line?.quantity ?? '');
    const unit = parsePounds(line?.unit_amount ?? '');
    if (quantity === null || unit === null) return { net: null, vat: null };
    const net = lineNet(quantity, unit);
    return { net, vat: vatOn(net, vatRateOf(vatDefaults, line?.vat_rate_id || null)) };
  });
  const net = sumPence(priced.map((line) => line.net ?? 0));
  const vat = sumPence(priced.map((line) => line.vat ?? 0));
  const listError = errors.lines?.root?.message ?? errors.lines?.message;

  const submit = handleSubmit((form) => {
    clearSubmitError();
    const lines = form.lines.flatMap((line) => {
      const quantity = parseQuantity(line.quantity);
      const unit = parsePounds(line.unit_amount);
      if (quantity === null || unit === null) return [];
      return [
        {
          description: line.description,
          quantity: formatQuantity(quantity),
          unit_amount: unit,
          ...(line.vat_rate_id ? { vat_rate_id: line.vat_rate_id } : {}),
        },
      ];
    });
    create.mutate(
      {
        client_id: clientId,
        time_entry_ids: [],
        disbursement_ids: [],
        group_by: 'job',
        overrides: [],
        advance_lines: lines,
      },
      {
        onSuccess: (invoice) => {
          toast({
            tone: 'success',
            title: 'Advance invoice drafted',
            description: 'Issue it as usual; assign time to it later from the invoice.',
          });
          void navigate(routes.org.invoice(organization.slug, invoice.id));
        },
        onError: (error) => handleSubmitError(toFormError(error)),
      },
    );
  });

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'description',
      header: 'Description',
      plain: true,
      className: 'min-w-64',
      cell: ({ index }) => (
        <Textarea
          label={`Description of line ${index + 1}`}
          hideLabel
          required
          rows={2}
          autoComplete="off"
          error={errors.lines?.[index]?.description?.message}
          {...register(`lines.${index}.description`)}
        />
      ),
    },
    {
      id: 'quantity',
      header: 'Qty',
      plain: true,
      className: 'w-24 min-w-20',
      cell: ({ index }) => (
        <Input
          label={`Quantity of line ${index + 1}`}
          hideLabel
          required
          inputMode="decimal"
          autoComplete="off"
          error={errors.lines?.[index]?.quantity?.message}
          {...register(`lines.${index}.quantity`)}
        />
      ),
    },
    {
      id: 'unit',
      header: 'Unit price (£)',
      plain: true,
      className: 'w-36 min-w-28',
      cell: ({ index }) => (
        <Input
          label={`Unit price of line ${index + 1}`}
          hideLabel
          required
          inputMode="decimal"
          autoComplete="off"
          error={errors.lines?.[index]?.unit_amount?.message}
          {...register(`lines.${index}.unit_amount`)}
        />
      ),
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
          options={vatDefaults.options}
          defaultLabel="Default"
          error={errors.lines?.[index]?.vat_rate_id?.message}
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
        const amount = priced[index]?.vat ?? null;
        return amount === null ? '—' : money(amount);
      },
    },
    {
      id: 'net',
      header: 'Net',
      plain: true,
      align: 'end',
      className: 'whitespace-nowrap font-semibold tabular-nums text-text',
      cell: ({ index }) => {
        const amount = priced[index]?.net ?? null;
        return amount === null ? '—' : money(amount);
      },
    },
  ];

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <DataTable
          caption="Lines billed in advance"
          columns={columns}
          rows={fields.map((field, index) => ({ key: field.id, index }))}
          rowKey={(row) => row.key}
          rowActions={({ index }) =>
            fields.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove line ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            ) : null
          }
          footer={
            <div className="flex flex-wrap items-start justify-between gap-3 border-t border-row-border px-4 py-3">
              <Button
                size="sm"
                leftIcon={<Plus aria-hidden="true" className="size-4" />}
                disabled={fields.length >= MAX_DOCUMENT_LINES}
                onClick={() => append(newLine())}
              >
                Add line
              </Button>
              <dl aria-label="Totals" className="flex min-w-56 flex-col gap-1.5 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-text-muted">Net</dt>
                  <dd className="tabular-nums">{money(net)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-text-muted">VAT</dt>
                  <dd className="tabular-nums">{money(vat)}</dd>
                </div>
                <div className="flex justify-between gap-6 font-semibold text-text">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(net + vat)}</dd>
                </div>
              </dl>
            </div>
          }
        />
        {listError ? (
          <p role="alert" className="text-xs text-danger">
            {listError}
          </p>
        ) : null}
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={create.isPending}
          disabled={retryIn > 0}
        >
          Draft advance invoice
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * Bills fees in advance: a draft with a line for each fee (quantity x unit price), issued like any
 * invoice. The time is assigned to a line later from the invoice, and leaves WIP then.
 */
export function AdvanceInvoicePanel({
  open,
  onClose,
  clientId,
  clientName,
  vatDefaults,
}: AdvanceInvoicePanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title="Bill fees in advance"
      description={`An invoice for ${clientName} now, on as many lines as needed; the time is assigned to it later, as the work is done.`}
    >
      {open ? (
        <AdvanceForm clientId={clientId} vatDefaults={vatDefaults} onClose={onClose} />
      ) : null}
    </FormPanel>
  );
}
