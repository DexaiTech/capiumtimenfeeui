import { useMemo } from 'react';

import { Select } from '@/components/ui';
import { timezoneOptions } from '@/features/account';
import type { Organization, OrganizationUpdate } from '@/types/organization';
import { currencySymbol } from '@/utils/money';

import { useOrganizationForm } from '../../hooks/useOrganizationForm';
import { localeSettingsSchema, type LocaleSettingsValues } from '../../schemas/general';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';

const FIELDS = ['timezone'] as const;

const toValues = (organization: Organization): LocaleSettingsValues => ({
  timezone: organization.timezone,
});

function toUpdate(values: LocaleSettingsValues, organization: Organization): OrganizationUpdate {
  return values.timezone === organization.timezone ? {} : { timezone: values.timezone };
}

function Fact({ term, children }: { term: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-text-muted">{term}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}

/** `timezone`, and the formats that are the same for every practice. */
export function LocaleSettingsCard({ organization, editable }: GeneralCardProps) {
  const { form, ...card } = useOrganizationForm<LocaleSettingsValues>({
    organization,
    schema: localeSettingsSchema,
    toValues,
    toUpdate,
    fields: FIELDS,
    savedTitle: 'Locale settings saved',
  });
  const {
    register,
    formState: { errors },
  } = form;
  const timezones = useMemo(() => timezoneOptions(organization.timezone), [organization.timezone]);

  return (
    <SettingsCard
      title="Locale"
      description="The timezone the practice works in. Dates and money are always shown the UK way."
      saveLabel="Save locale"
      editable={editable}
      dirty={card.isDirty}
      saving={card.saving}
      retryIn={card.retryIn}
      submitError={card.submitError}
      onSubmit={card.onSubmit}
      onDiscard={card.discard}
    >
      <Select
        label="Timezone"
        options={timezones}
        className="sm:max-w-md"
        hint="Decides what 'today' is for time recording, rate periods and period locks."
        error={errors.timezone?.message}
        {...register('timezone')}
      />
      <dl className="grid gap-4 sm:grid-cols-3">
        <Fact term="Date format">dd/MM/yyyy, for example 31/12/2026</Fact>
        <Fact term="Currency">
          {`${organization.currency} (${currencySymbol(organization.currency)}), set when the practice was created`}
        </Fact>
        <Fact term="Money and durations">£1,234.56 and 7:30 (hours:minutes)</Fact>
      </dl>
    </SettingsCard>
  );
}
