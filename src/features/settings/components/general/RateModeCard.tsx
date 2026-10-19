import { useWatch } from 'react-hook-form';

import { Select } from '@/components/ui';
import type { Organization, OrganizationUpdate } from '@/types/organization';

import { useOrganizationForm } from '../../hooks/useOrganizationForm';
import { rateSettingsSchema, type RateSettingsValues } from '../../schemas/general';
import { RATE_MODE_HELP, RATE_MODE_OPTIONS } from '../../utils/general';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';

const FIELDS = ['rate_mode'] as const;

const toValues = (organization: Organization): RateSettingsValues => ({
  rate_mode: organization.rate_mode,
});

function toUpdate(values: RateSettingsValues, organization: Organization): OrganizationUpdate {
  return values.rate_mode === organization.rate_mode ? {} : { rate_mode: values.rate_mode };
}

/** `rate_mode`: whether a person's own charge-out rate comes before their grade's. */
export function RateModeCard({ organization, editable }: GeneralCardProps) {
  const { form, ...card } = useOrganizationForm<RateSettingsValues>({
    organization,
    schema: rateSettingsSchema,
    toValues,
    toUpdate,
    fields: FIELDS,
    savedTitle: 'Rate settings saved',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const mode = useWatch({ control, name: 'rate_mode' });

  return (
    <SettingsCard
      title="Rates"
      description="Which charge-out rates price recorded time. Changing it never touches time that is already recorded: entries follow it when they are edited or re-rated."
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
    </SettingsCard>
  );
}
