import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, FormPanel, Input, useToast } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { parsePounds } from '@/utils/money';

import { useCreateInvoice, useVatOptions } from '../../api';
import { advanceSchema, type AdvanceValues } from '../../schemas/forms';
import { toFormError } from '../../utils/errors';
import { DialogActions } from '../DialogActions';
import { VatSelect } from '../VatSelect';

export interface AdvanceInvoicePanelProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

function AdvanceForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { options } = useVatOptions();
  const create = useCreateInvoice();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdvanceValues>({
    resolver: zodResolver(advanceSchema),
    defaultValues: { description: 'Fees in advance', amount: '', vat_rate_id: '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<AdvanceValues>({ setError, fields: ['description', 'amount', 'vat_rate_id'] });

  const submit = handleSubmit((form) => {
    clearSubmitError();
    const amount = parsePounds(form.amount);
    if (amount === null) return;
    create.mutate(
      {
        client_id: clientId,
        time_entry_ids: [],
        disbursement_ids: [],
        group_by: 'job',
        overrides: [],
        advance: {
          description: form.description,
          net_amount: amount,
          ...(form.vat_rate_id ? { vat_rate_id: form.vat_rate_id } : {}),
        },
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

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Description"
          required
          autoComplete="off"
          hint="As it reads on the invoice, for example Fees in advance 2026/27."
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount (£)"
            required
            inputMode="decimal"
            autoComplete="off"
            hint="Before VAT."
            error={errors.amount?.message}
            {...register('amount')}
          />
          <VatSelect
            options={options}
            defaultLabel="Default"
            error={errors.vat_rate_id?.message}
            {...register('vat_rate_id')}
          />
        </div>
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
 * Bills fees in advance: a draft with one line of the amount, issued like any invoice. The time is
 * assigned to it later from the invoice, and leaves WIP then.
 */
export function AdvanceInvoicePanel({
  open,
  onClose,
  clientId,
  clientName,
}: AdvanceInvoicePanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title="Bill fees in advance"
      description={`An invoice for ${clientName} now; the time is assigned to it later, as the work is done.`}
    >
      {open ? <AdvanceForm clientId={clientId} onClose={onClose} /> : null}
    </FormPanel>
  );
}
