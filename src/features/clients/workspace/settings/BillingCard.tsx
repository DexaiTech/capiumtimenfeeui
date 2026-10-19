import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  Button,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
  type SelectOption,
} from '@/components/ui';
import { isApiError } from '@/services/api';
import { formatBasisPoints } from '@/utils/money';

import {
  useInvoiceTemplates,
  useServiceOptions,
  useUpdateClient,
  useUpdateContact,
  useVatRates,
} from '../../api';
import type { ClientDetail } from '../../types';
import type { ClientAbilities } from '../abilities';
import { SettingsCard } from './SettingsCard';
import {
  BILLING_FORM_FIELDS,
  billingFlagChanges,
  billingFormSchema,
  billingToForm,
  toBillingPatch,
  type BillingFormValues,
} from './schemas';

export interface BillingCardProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

/** The select's options: "none", the choices, and the client's current choice when it is not among them. */
function choices(
  none: string,
  items: ReadonlyArray<SelectOption>,
  current: SelectOption | null,
): SelectOption[] {
  const options: SelectOption[] = [{ value: '', label: none }, ...items];
  if (current && !items.some((item) => item.value === current.value)) options.push(current);
  return options;
}

/** A 404 naming a field: the choice was removed while the form was open. */
function missingChoiceField(error: unknown): keyof BillingFormValues | null {
  if (!isApiError(error) || error.status !== 404) return null;
  const details: unknown = error.details;
  if (typeof details !== 'object' || details === null || !('field' in details)) return null;
  const field = details.field;
  return typeof field === 'string' && (BILLING_FORM_FIELDS as readonly string[]).includes(field)
    ? (field as keyof BillingFormValues)
    : null;
}

function BillingForm({ client, abilities }: BillingCardProps) {
  const { toast } = useToast();
  const update = useUpdateClient();
  const updateContact = useUpdateContact();
  const vatRates = useVatRates();
  const templates = useInvoiceTemplates();
  const services = useServiceOptions();
  const initial = useMemo(() => billingToForm(client), [client]);
  const canEdit = abilities.edit;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<BillingFormValues>({
    resolver: zodResolver(billingFormSchema),
    values: initial,
    resetOptions: { keepDirtyValues: true },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<BillingFormValues>({ setError, fields: BILLING_FORM_FIELDS });

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    const body = toBillingPatch(values, client);
    const flags = billingFlagChanges(
      values.billing_contact_id,
      client.contacts,
      initial.billing_contact_id,
    );
    if (Object.keys(body).length === 0 && flags.length === 0) return;
    try {
      if (Object.keys(body).length > 0) {
        await update.mutateAsync({ clientId: client.id, body });
      }
      for (const change of flags) {
        await updateContact.mutateAsync({
          clientId: client.id,
          contactId: change.contactId,
          body: { is_billing: change.is_billing },
        });
      }
      reset(values);
      toast({ tone: 'success', title: 'Billing settings saved', description: client.name });
    } catch (error) {
      const field = missingChoiceField(error);
      if (field) {
        setError(
          field,
          { type: 'server', message: 'This choice is no longer available. Choose another.' },
          { shouldFocus: true },
        );
        return;
      }
      handleSubmitError(error);
    }
  });

  const contactOptions: SelectOption[] = [
    { value: '', label: 'No billing contact' },
    ...client.contacts.map((contact) => ({
      value: contact.id,
      label: contact.email ? `${contact.name} (${contact.email})` : contact.name,
    })),
  ];
  const vatOptions = choices(
    'No default VAT code',
    (vatRates.data ?? []).map((rate) => ({
      value: rate.id,
      label: `${rate.name} (${formatBasisPoints(rate.rate_bp)})`,
    })),
    client.default_vat_rate_id
      ? { value: client.default_vat_rate_id, label: 'Current VAT code' }
      : null,
  );
  const serviceOptions = choices(
    'No default service',
    (services.data ?? []).map((service) => ({ value: service.id, label: service.name })),
    client.default_service
      ? { value: client.default_service.service_id, label: client.default_service.name }
      : null,
  );
  const templateOptions = choices(
    'Practice default',
    (templates.data ?? []).map((template) => ({
      value: template.id,
      label: template.is_default ? `${template.name} (default)` : template.name,
    })),
    client.invoice_template
      ? { value: client.invoice_template.id, label: client.invoice_template.name }
      : null,
  );
  const busy = isSubmitting || update.isPending || updateContact.isPending;

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Invoice email"
          type="email"
          autoComplete="off"
          hint="Where invoices to this client are sent."
          error={errors.invoice_email?.message}
          disabled={!canEdit}
          {...register('invoice_email')}
        />
        <Select
          label="Billing contact"
          options={contactOptions}
          hint={
            client.contacts.length === 0
              ? 'Add a contact on the Contacts tab to choose one.'
              : undefined
          }
          error={errors.billing_contact_id?.message}
          disabled={!canEdit}
          {...register('billing_contact_id')}
        />
        <Input
          label="Payment terms (days)"
          inputMode="numeric"
          hint="Blank: the practice's default terms."
          error={errors.payment_terms_days?.message}
          disabled={!canEdit}
          {...register('payment_terms_days')}
        />
        <Select
          label="Default VAT code"
          options={vatOptions}
          error={errors.default_vat_rate_id?.message}
          disabled={!canEdit}
          {...register('default_vat_rate_id')}
        />
        <Select
          label="Default service"
          options={serviceOptions}
          hint="Pre-selected when time is recorded for this client."
          error={errors.default_service_id?.message}
          disabled={!canEdit}
          {...register('default_service_id')}
        />
        <Select
          label="Invoice template"
          options={templateOptions}
          error={errors.invoice_template_id?.message}
          disabled={!canEdit}
          {...register('invoice_template_id')}
        />
        <Textarea
          label="Billing notes"
          rows={3}
          className="sm:col-span-2"
          error={errors.billing_notes?.message}
          disabled={!canEdit}
          {...register('billing_notes')}
        />
      </div>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={busy} disabled={!isDirty || retryIn > 0}>
            Save billing settings
          </Button>
        </div>
      ) : null}
    </form>
  );
}

/** Billing: how this client is invoiced. Saves its own PATCH, with only the changed fields. */
export function BillingCard({ client, abilities }: BillingCardProps) {
  const vatRates = useVatRates();
  const templates = useInvoiceTemplates();
  const services = useServiceOptions();
  // The selects need their options before the form can show the saved choices.
  const loading = vatRates.isPending || templates.isPending || services.isPending;
  return (
    <SettingsCard
      title="Billing"
      description="How this client is invoiced: who receives the invoice, the terms and the defaults."
    >
      {loading ? (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} shape="rect" className="h-9" />
          ))}
        </div>
      ) : (
        <BillingForm client={client} abilities={abilities} />
      )}
    </SettingsCard>
  );
}
