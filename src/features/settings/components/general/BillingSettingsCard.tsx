import { Controller, useWatch } from 'react-hook-form';

import { Input, Select, Switch } from '@/components/ui';
import type { Organization, OrganizationUpdate } from '@/types/organization';
import { currencySymbol, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useOrganizationForm } from '../../hooks/useOrganizationForm';
import { billingSettingsSchema, type BillingSettingsValues } from '../../schemas/general';
import { WIP_MODE_HELP, WIP_MODE_OPTIONS } from '../../utils/general';
import { bpToPercentInput, parsePercentToBp } from '../../utils/vat';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';

const FIELDS = [
  'fixed_fee_wip_mode',
  'wip_adjustment_approval_threshold',
  'wip_write_off_approval_threshold_percent',
  'invoice_approval_required',
  'invoice_approval_threshold',
  'payment_reminders_enabled',
  'payment_reminder_days_after_due',
] as const;
const DEFAULT_PERCENT = '10';

function toValues(organization: Organization): BillingSettingsValues {
  const { currency } = organization;
  const percent = organization.wip_write_off_approval_threshold_percent;
  return {
    fixed_fee_wip_mode: organization.fixed_fee_wip_mode,
    wip_adjustment_approval_threshold: penceToPoundsInput(
      organization.wip_adjustment_approval_threshold,
      currency,
    ),
    wip_write_off_percent_enabled: percent !== null,
    wip_write_off_approval_threshold_percent:
      percent !== null ? bpToPercentInput(percent) : DEFAULT_PERCENT,
    invoice_approval_required: organization.invoice_approval_required,
    invoice_approval_threshold: penceToPoundsInput(
      organization.invoice_approval_threshold,
      currency,
    ),
    payment_reminders_enabled: organization.payment_reminders_enabled,
    payment_reminder_days_after_due: String(organization.payment_reminder_days_after_due),
  };
}

function toUpdate(values: BillingSettingsValues, organization: Organization): OrganizationUpdate {
  const body: OrganizationUpdate = {};
  const { currency } = organization;
  if (values.fixed_fee_wip_mode !== organization.fixed_fee_wip_mode) {
    body.fixed_fee_wip_mode = values.fixed_fee_wip_mode;
  }
  const wip = parsePounds(values.wip_adjustment_approval_threshold, currency);
  if (wip !== null && wip !== organization.wip_adjustment_approval_threshold) {
    body.wip_adjustment_approval_threshold = wip;
  }
  const percent = values.wip_write_off_percent_enabled
    ? parsePercentToBp(values.wip_write_off_approval_threshold_percent)
    : null;
  if (percent !== organization.wip_write_off_approval_threshold_percent) {
    body.wip_write_off_approval_threshold_percent = percent;
  }
  if (values.invoice_approval_required !== organization.invoice_approval_required) {
    body.invoice_approval_required = values.invoice_approval_required;
  }
  const invoice = parsePounds(values.invoice_approval_threshold, currency);
  if (invoice !== null && invoice !== organization.invoice_approval_threshold) {
    body.invoice_approval_threshold = invoice;
  }
  if (values.payment_reminders_enabled !== organization.payment_reminders_enabled) {
    body.payment_reminders_enabled = values.payment_reminders_enabled;
  }
  const days = Number(values.payment_reminder_days_after_due);
  if (days !== organization.payment_reminder_days_after_due) {
    body.payment_reminder_days_after_due = days;
  }
  return body;
}

/** `fixed_fee_wip_mode`, the WIP and invoice approval thresholds and the payment reminders. */
export function BillingSettingsCard({ organization, editable }: GeneralCardProps) {
  const { form, ...card } = useOrganizationForm<BillingSettingsValues>({
    organization,
    schema: billingSettingsSchema,
    toValues,
    toUpdate,
    fields: FIELDS,
    savedTitle: 'WIP and billing settings saved',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const mode = useWatch({ control, name: 'fixed_fee_wip_mode' });
  const percentEnabled = useWatch({ control, name: 'wip_write_off_percent_enabled' });
  const approval = useWatch({ control, name: 'invoice_approval_required' });
  const reminders = useWatch({ control, name: 'payment_reminders_enabled' });
  const symbol = currencySymbol(organization.currency);

  return (
    <SettingsCard
      title="WIP and billing"
      description="When a fixed fee counts as work in progress, which adjustments and invoices need approval, and the reminders for overdue invoices."
      saveLabel="Save billing settings"
      editable={editable}
      dirty={card.isDirty}
      saving={card.saving}
      retryIn={card.retryIn}
      submitError={card.submitError}
      onSubmit={card.onSubmit}
      onDiscard={card.discard}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Fixed-fee WIP"
          options={WIP_MODE_OPTIONS}
          hint={WIP_MODE_HELP[mode]}
          error={errors.fixed_fee_wip_mode?.message}
          {...register('fixed_fee_wip_mode')}
        />
        <Input
          label={`WIP adjustment approval threshold (${symbol})`}
          inputMode="decimal"
          autoComplete="off"
          leftIcon={<span className="text-sm">{symbol}</span>}
          hint="A WIP write-on or write-off above this amount needs approval. 0 means every adjustment does."
          error={errors.wip_adjustment_approval_threshold?.message}
          {...register('wip_adjustment_approval_threshold')}
        />
      </div>

      <Controller
        control={control}
        name="wip_write_off_percent_enabled"
        render={({ field }) => (
          <Switch
            ref={field.ref}
            checked={field.value}
            onChange={field.onChange}
            disabled={!editable}
            label="Write-off percentage rule"
            description="On: a write-off above this share of the job's or client's current WIP also needs approval, in addition to the amount threshold above."
            className="rounded-md border border-border px-3 py-2"
          />
        )}
      />
      <Input
        label="Write-off approval threshold (%)"
        inputMode="decimal"
        autoComplete="off"
        className="sm:max-w-sm"
        disabled={!percentEnabled}
        hint={
          percentEnabled
            ? 'A write-off above this percentage of the WIP there is to write off needs approval.'
            : 'Turn on the percentage rule to set it.'
        }
        error={errors.wip_write_off_approval_threshold_percent?.message}
        {...register('wip_write_off_approval_threshold_percent')}
      />

      <Controller
        control={control}
        name="invoice_approval_required"
        render={({ field }) => (
          <Switch
            ref={field.ref}
            checked={field.value}
            onChange={field.onChange}
            disabled={!editable}
            label="Invoice approval"
            description="On: invoices at or above the threshold must be approved before they are issued."
            className="rounded-md border border-border px-3 py-2"
          />
        )}
      />
      <Input
        label={`Invoice approval threshold (${symbol})`}
        inputMode="decimal"
        autoComplete="off"
        leftIcon={<span className="text-sm">{symbol}</span>}
        className="sm:max-w-sm"
        disabled={!approval}
        hint={
          approval
            ? 'Invoices at or above this gross amount need approval. 0 means every invoice.'
            : 'Turn on invoice approval to set a threshold.'
        }
        error={errors.invoice_approval_threshold?.message}
        {...register('invoice_approval_threshold')}
      />

      <Controller
        control={control}
        name="payment_reminders_enabled"
        render={({ field }) => (
          <Switch
            ref={field.ref}
            checked={field.value}
            onChange={field.onChange}
            disabled={!editable}
            label="Automatic payment reminders"
            description="On: a daily job emails clients about invoices that are overdue and have not been reminded."
            className="rounded-md border border-border px-3 py-2"
          />
        )}
      />
      <Input
        label="Days after the due date"
        inputMode="numeric"
        autoComplete="off"
        className="sm:max-w-sm"
        disabled={!reminders}
        hint={
          reminders
            ? 'The reminder goes this many days after an invoice falls due, from 1 to 365.'
            : 'Turn on payment reminders to set the delay.'
        }
        error={errors.payment_reminder_days_after_due?.message}
        {...register('payment_reminder_days_after_due')}
      />
    </SettingsCard>
  );
}
