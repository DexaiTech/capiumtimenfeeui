import { Controller, useWatch } from 'react-hook-form';

import { Input, Select, Switch } from '@/components/ui';
import type { Organization, OrganizationUpdate } from '@/types/organization';
import { bpToMultiplierInput, parseMultiplierToBp } from '@/utils/multiplier';

import { useOrganizationForm } from '../../hooks/useOrganizationForm';
import { rateSettingsSchema, type RateSettingsValues } from '../../schemas/general';
import { parseMarkupToBp, RATE_MODE_HELP, RATE_MODE_OPTIONS } from '../../utils/general';
import { bpToPercentInput } from '../../utils/vat';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';

const FIELDS = [
  'rate_mode',
  'overtime_enabled',
  'overtime_multiplier',
  'cost_plus_markup',
] as const;

const toValues = (organization: Organization): RateSettingsValues => ({
  rate_mode: organization.rate_mode,
  overtime_enabled: organization.overtime_enabled,
  overtime_multiplier: bpToMultiplierInput(organization.overtime_multiplier_bp),
  cost_plus_markup: bpToPercentInput(organization.cost_plus_markup_bp),
});

function toUpdate(values: RateSettingsValues, organization: Organization): OrganizationUpdate {
  const body: OrganizationUpdate = {};
  if (values.rate_mode !== organization.rate_mode) body.rate_mode = values.rate_mode;
  if (values.overtime_enabled !== organization.overtime_enabled) {
    body.overtime_enabled = values.overtime_enabled;
  }
  const multiplier = parseMultiplierToBp(values.overtime_multiplier);
  if (multiplier !== null && multiplier !== organization.overtime_multiplier_bp) {
    body.overtime_multiplier_bp = multiplier;
  }
  const markup = parseMarkupToBp(values.cost_plus_markup);
  if (markup !== null && markup !== organization.cost_plus_markup_bp) {
    body.cost_plus_markup_bp = markup;
  }
  return body;
}

/**
 * `rate_mode`: whether a person's own charge-out rate comes before their grade's; the overtime
 * switch with the multiplier overtime time is priced at; and the cost-plus mark-up the recovery
 * analysis compares invoices with.
 */
export function RateModeCard({ organization, editable }: GeneralCardProps) {
  const { form, ...card } = useOrganizationForm<RateSettingsValues>({
    organization,
    schema: rateSettingsSchema,
    toValues,
    toUpdate,
    fields: FIELDS,
    fieldNames: {
      overtime_multiplier_bp: 'overtime_multiplier',
      cost_plus_markup_bp: 'cost_plus_markup',
    },
    savedTitle: 'Rate settings saved',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const mode = useWatch({ control, name: 'rate_mode' });
  const overtime = useWatch({ control, name: 'overtime_enabled' });

  return (
    <SettingsCard
      title="Rates"
      description="Which charge-out rates price recorded time, and whether overtime is paid at a premium. Changing either never touches time that is already recorded: entries follow it when they are edited or re-rated."
      saveLabel="Save rate settings"
      editable={editable}
      dirty={card.isDirty}
      saving={card.saving}
      retryIn={card.retryIn}
      submitError={card.submitError}
      onSubmit={card.onSubmit}
      onDiscard={card.discard}
    >
      <Select
        label="Rate mode"
        options={RATE_MODE_OPTIONS}
        className="sm:max-w-md"
        hint={RATE_MODE_HELP[mode]}
        error={errors.rate_mode?.message}
        {...register('rate_mode')}
      />
      <Controller
        control={control}
        name="overtime_enabled"
        render={({ field }) => (
          <Switch
            ref={field.ref}
            checked={field.value}
            onChange={field.onChange}
            disabled={!editable}
            label="Overtime"
            description="On: time can be marked as overtime when it is recorded, and is charged and costed at the normal rate times the multiplier. Off: overtime is hidden everywhere."
            className="rounded-md border border-border px-3 py-2"
          />
        )}
      />
      <Input
        label="Overtime rate (times the normal rate)"
        required={overtime}
        inputMode="decimal"
        autoComplete="off"
        className="sm:max-w-sm"
        disabled={!overtime}
        hint={
          overtime
            ? 'For everyone, for example 1.5 for time and a half. A staff member can have their own on their staff page.'
            : 'Turn overtime on to set it.'
        }
        error={errors.overtime_multiplier?.message}
        {...register('overtime_multiplier')}
      />
      <Input
        label="Cost-plus mark-up (%)"
        required
        inputMode="decimal"
        autoComplete="off"
        className="sm:max-w-sm"
        hint="Recovery analysis: what the work would bill at its cost plus this mark-up. 50 bills time that cost £50 an hour at £75."
        error={errors.cost_plus_markup?.message}
        {...register('cost_plus_markup')}
      />
    </SettingsCard>
  );
}
