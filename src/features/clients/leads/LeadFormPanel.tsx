import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, FormPanel, Input, Select, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { currencySymbol, formatMoney, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useCreateLead, useUpdateLead } from '../api';
import { CLIENT_TYPE_OPTIONS } from '../constants';
import {
  EMPTY_LEAD_FORM,
  LEAD_FORM_FIELDS,
  leadFormSchema,
  leadToForm,
  toLeadPayload,
  type LeadFormValues,
} from './schema';
import type { Lead, LeadUpdate } from './types';

export interface LeadFormPanelProps {
  /** The lead to change, null to add one. */
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

/** What a typed amount comes to, for the total under the costs (0 while it is not a number). */
const penceOf = (value: string) => (value.trim() === '' ? 0 : (parsePounds(value) ?? 0));

function LeadForm({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const { organization } = useOrg();
  const currency = organization.currency;
  const create = useCreateLead();
  const update = useUpdateLead();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: lead
      ? leadToForm(lead, (pence) => penceToPoundsInput(pence, currency))
      : EMPTY_LEAD_FORM,
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<LeadFormValues>({ setError, fields: LEAD_FORM_FIELDS });
  const saving = create.isPending || update.isPending;
  const [acquisition, onboarding] = useWatch({
    control,
    name: ['acquisition_cost', 'onboarding_cost'],
  });
  const total = Math.max(penceOf(acquisition), 0) + Math.max(penceOf(onboarding), 0);

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const payload = toLeadPayload(values);

    if (!lead) {
      create.mutate(payload, {
        onSuccess: (created) => {
          toast({ tone: 'success', title: `${created.name} added` });
          onClose();
        },
        onError: handleSubmitError,
      });
      return;
    }

    // PATCH is partial: send only what changed.
    const changes: LeadUpdate = {};
    for (const field of LEAD_FORM_FIELDS) {
      if (payload[field] !== lead[field]) Object.assign(changes, { [field]: payload[field] });
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { leadId: lead.id, body: changes },
      {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: `${saved.name} saved` });
          onClose();
        },
        onError: handleSubmitError,
      },
    );
  });

  const symbol = currencySymbol(currency);
  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
        <Input
          label="Name"
          required
          autoComplete="off"
          maxLength={200}
          hint="The business or person, as the client will be called."
          error={errors.name?.message}
          {...register('name')}
        />
        <Select
          label="Client type"
          options={CLIENT_TYPE_OPTIONS}
          error={errors.client_type?.message}
          {...register('client_type')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Contact name"
            autoComplete="off"
            maxLength={120}
            hint="Becomes the client's primary contact."
            error={errors.contact_name?.message}
            {...register('contact_name')}
          />
          <Input
            label="Source"
            autoComplete="off"
            maxLength={100}
            hint="Where the lead came from, for example Referral or Website."
            error={errors.source?.message}
            {...register('source')}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="off"
            maxLength={254}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Phone"
            type="tel"
            autoComplete="off"
            maxLength={40}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label={`Acquisition cost (${symbol})`}
            inputMode="decimal"
            hint="What winning the lead cost: marketing, referral fees, meetings."
            error={errors.acquisition_cost?.message}
            {...register('acquisition_cost')}
          />
          <Input
            label={`Onboarding cost (${symbol})`}
            inputMode="decimal"
            hint="What taking the client on costs. It can be added after converting."
            error={errors.onboarding_cost?.message}
            {...register('onboarding_cost')}
          />
        </div>
        <p className="text-sm text-text-muted">
          Total cost{' '}
          <strong className="font-semibold tabular-nums text-text">
            {formatMoney(total, currency)}
          </strong>
        </p>
        <Textarea
          label="Notes"
          rows={3}
          maxLength={5000}
          hint="Copied to the client when the lead is converted."
          error={errors.notes?.message}
          {...register('notes')}
        />
      </form>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={saving}
          disabled={(lead !== null && !isDirty) || retryIn > 0}
        >
          {lead ? 'Save lead' : 'Add lead'}
        </Button>
      </div>
    </>
  );
}

/** Add a lead, or change one: who it is, where it came from and what winning it cost. */
export function LeadFormPanel({ lead, open, onClose }: LeadFormPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={lead ? 'Edit lead' : 'Add lead'}
      description={
        lead ? lead.name : 'A prospective client. Convert it into a client once it is won.'
      }
    >
      {open ? <LeadForm key={lead?.id ?? 'new'} lead={lead} onClose={onClose} /> : null}
    </FormPanel>
  );
}
