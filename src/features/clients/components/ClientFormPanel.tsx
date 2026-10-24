import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, FormPanel, Select, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { ApiError, isApiError } from '@/services/api';

import { useCreateClient, useStaffDirectory, useUpdateClient } from '../api';
import { isLinked, MANAGED_MESSAGE, managedFields } from '../central/format';
import {
  CLIENT_STATUS_OPTIONS,
  CLIENT_TYPE_OPTIONS,
  KNOWN_SEGMENTS,
  MONTH_OPTIONS,
  SOFTWARE_OPTIONS,
} from '../constants';
import {
  CLIENT_FORM_FIELDS,
  clientFormSchema,
  clientToForm,
  EMPTY_CLIENT_FORM,
  isClientFormField,
  toClientCreate,
  toClientUpdate,
  type ClientFormValues,
} from '../schemas';
import type { ClientDetail, ClientRead, ClientUpdate } from '../types';

export interface ClientFormPanelProps {
  open: boolean;
  /** The client to edit; null to add one. */
  client: ClientRead | null;
  onClose: () => void;
  onSaved?: (client: ClientDetail) => void;
}

/** Keeps only the fields whose value differs (PATCH is partial). */
function changedFields(next: ClientUpdate, previous: ClientUpdate): ClientUpdate {
  const changes: Record<string, unknown> & ClientUpdate = {};
  for (const [key, value] of Object.entries(next)) {
    if (previous[key as keyof ClientUpdate] !== value) changes[key] = value;
  }
  return changes;
}

function ClientForm({ client, onClose, onSaved }: Omit<ClientFormPanelProps, 'open'>) {
  const { can } = useOrg();
  const { toast } = useToast();
  const formId = useId();
  const create = useCreateClient();
  const update = useUpdateClient();
  const staff = useStaffDirectory();
  const canPickPeople = can('member.read');
  const canArchive = can('client.delete');
  // A client linked to the central service takes its name and address from there.
  const linked = client !== null && isLinked(client);
  const addressHintId = `${formId}-address-managed`;
  const managed = linked
    ? { disabled: true, 'aria-describedby': addressHintId }
    : { disabled: false };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? clientToForm(client) : EMPTY_CLIENT_FORM,
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ClientFormValues>({ setError, fields: CLIENT_FORM_FIELDS });

  const onSubmit = handleSubmit(async (values) => {
    clearSubmitError();
    try {
      let saved: ClientDetail;
      if (client) {
        const body = changedFields(toClientUpdate(values), toClientUpdate(clientToForm(client)));
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        saved = await update.mutateAsync({ clientId: client.id, body });
        toast({ tone: 'success', title: 'Client updated', description: saved.name });
      } else {
        saved = await create.mutateAsync(toClientCreate(values));
        toast({
          tone: 'success',
          title: 'Client created',
          description: `${saved.name} (${saved.code})`,
        });
      }
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (isApiError(error) && error.code === 'CLIENT_CODE_TAKEN') {
        setError('code', { type: 'server', message: error.message }, { shouldFocus: true });
        return;
      }
      if (isApiError(error) && error.code === 'CLIENT_FIELD_MANAGED_CENTRALLY') {
        // Someone linked the client while the form was open: say what the form says.
        managedFields(error.details).forEach((field, index) => {
          if (isClientFormField(field)) {
            setError(
              field,
              { type: 'server', message: MANAGED_MESSAGE },
              { shouldFocus: index === 0 },
            );
          }
        });
        handleSubmitError(
          new ApiError({
            status: error.status,
            code: error.code,
            message: MANAGED_MESSAGE,
            requestId: error.requestId,
          }),
        );
        return;
      }
      handleSubmitError(error);
    }
  });

  const statusOptions = CLIENT_STATUS_OPTIONS.map((option) => ({
    ...option,
    // Moving into or out of "archived" needs client.delete as well.
    disabled: option.value === 'archived' && !canArchive && client?.status !== 'archived',
  }));
  const memberOptions = [
    { value: '', label: 'Nobody' },
    ...(staff.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];
  const busy = isSubmitting || create.isPending || update.isPending;

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-5"
      >
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Client">
          <Input
            label="Client name"
            required
            autoComplete="organization"
            error={errors.name?.message}
            hint={linked ? MANAGED_MESSAGE : undefined}
            className="sm:col-span-2"
            data-autofocus={linked ? undefined : true}
            disabled={linked}
            {...register('name')}
          />
          <Input
            label="Client code"
            hint="Left blank, the next code from the numbering sequence is used."
            error={errors.code?.message}
            {...register('code')}
          />
          <Select
            label="Client type"
            options={CLIENT_TYPE_OPTIONS}
            error={errors.client_type?.message}
            {...register('client_type')}
          />
          <Select
            label="Status"
            options={statusOptions}
            error={errors.status?.message}
            {...register('status')}
          />
          <Input
            label="Segment"
            list={`${formId}-segments`}
            error={errors.segment?.message}
            {...register('segment')}
          />
          <datalist id={`${formId}-segments`}>
            {KNOWN_SEGMENTS.map((segment) => (
              <option key={segment} value={segment} />
            ))}
          </datalist>
        </section>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Identifiers">
          <Input
            label="Company number"
            error={errors.company_number?.message}
            {...register('company_number')}
          />
          <Input label="UTR" error={errors.utr?.message} {...register('utr')} />
          <Input
            label="VAT number"
            error={errors.vat_number?.message}
            {...register('vat_number')}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2" aria-label="Contact details">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Phone"
            type="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
          {linked ? (
            <p id={addressHintId} className="text-xs text-text-muted sm:col-span-2">
              {MANAGED_MESSAGE}
            </p>
          ) : null}
          <Input
            label="Address line 1"
            error={errors.address_line1?.message}
            {...managed}
            {...register('address_line1')}
          />
          <Input
            label="Address line 2"
            error={errors.address_line2?.message}
            {...managed}
            {...register('address_line2')}
          />
          <Input
            label="Town or city"
            error={errors.city?.message}
            {...managed}
            {...register('city')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Postcode"
              error={errors.postcode?.message}
              {...managed}
              {...register('postcode')}
            />
            <Input
              label="Country"
              required
              maxLength={2}
              error={errors.country?.message}
              {...managed}
              {...register('country')}
            />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Practice">
          <Select
            label="Year-end month"
            options={[{ value: '', label: 'Not set' }, ...MONTH_OPTIONS]}
            error={errors.year_end_month?.message}
            {...register('year_end_month')}
          />
          <Input
            label="Year-end day"
            inputMode="numeric"
            error={errors.year_end_day?.message}
            {...register('year_end_day')}
          />
          <Input
            label="Payment terms (days)"
            inputMode="numeric"
            error={errors.payment_terms_days?.message}
            {...register('payment_terms_days')}
          />
          <Input
            label="Health score"
            inputMode="numeric"
            hint="0 to 100"
            error={errors.health_score?.message}
            {...register('health_score')}
          />
          <Select
            label="Accounting software"
            options={[{ value: '', label: 'None' }, ...SOFTWARE_OPTIONS]}
            error={errors.accounting_software?.message}
            {...register('accounting_software')}
          />
          {canPickPeople ? (
            <>
              <Select
                label="Manager"
                options={memberOptions}
                error={errors.manager_user_id?.message}
                {...register('manager_user_id')}
              />
              <Select
                label="Partner"
                options={memberOptions}
                error={errors.partner_user_id?.message}
                {...register('partner_user_id')}
              />
            </>
          ) : null}
        </section>

        <section className="grid gap-4" aria-label="Notes">
          <Textarea label="Notes" rows={3} error={errors.notes?.message} {...register('notes')} />
          <Textarea
            label="Billing notes"
            rows={2}
            error={errors.billing_notes?.message}
            {...register('billing_notes')}
          />
        </section>
      </form>
      <div className="sticky -bottom-5 z-10 -mx-5 rounded-b-xl mt-5 flex flex-col-reverse gap-2 border-t border-border bg-surface-raised px-5 pt-4 pb-5 sm:flex-row sm:justify-end md:-mx-6 md:px-6">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={busy} disabled={retryIn > 0}>
          {client ? 'Save changes' : 'Add Client'}
        </Button>
      </div>
    </>
  );
}

/** Add or edit a client (react-hook-form + zod mirroring `ClientCreate` / `ClientUpdate`). */
export function ClientFormPanel({ open, client, onClose, onSaved }: ClientFormPanelProps) {
  return (
    <FormPanel open={open} onClose={onClose} title={client ? `Edit ${client.name}` : 'Add Client'}>
      {open ? (
        <ClientForm key={client?.id ?? 'new'} client={client} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </FormPanel>
  );
}
