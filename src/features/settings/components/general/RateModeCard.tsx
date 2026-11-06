import { Controller, useWatch } from 'react-hook-form';
import { Link } from 'react-router';

import { Input, Select, Switch } from '@/components/ui';
import { routes } from '@/constants/routes';
import type { RecoveryRate } from '@/types';
import type { Organization, OrganizationUpdate } from '@/types/organization';
import {
  RECOVERY_RATE_HINTS,
  RECOVERY_RATE_LABELS,
  RECOVERY_RATES,
  rateOrderText,
} from '@/utils/recovery';

import { useOrganizationForm } from '../../hooks/useOrganizationForm';
import { rateSettingsSchema, type RateSettingsValues } from '../../schemas/general';
import { parseMarkupToBp } from '../../utils/general';
import { bpToPercentInput } from '../../utils/vat';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';

const FIELDS = [
  'overtime_enabled',
  'cost_plus_markup',
  'rate_order_1',
  'rate_order_2',
  'rate_order_3',
] as const;

const RATE_OPTIONS = RECOVERY_RATES.map((rate) => ({
  value: rate,
  label: RECOVERY_RATE_LABELS[rate],
}));
const PLACES = ['1st', '2nd', '3rd'] as const;

/** The practice's order, falling back to the default for any rate it lacks. */
function orderOf(organization: Organization): [RecoveryRate, RecoveryRate, RecoveryRate] {
  const order = [...(organization.recovery_rate_order ?? [])];
  for (const rate of RECOVERY_RATES) if (!order.includes(rate)) order.push(rate);
  return [order[0] ?? 'client_job', order[1] ?? 'task', order[2] ?? 'staff'];
}

const toValues = (organization: Organization): RateSettingsValues => ({
  overtime_enabled: organization.overtime_enabled,
  cost_plus_markup: bpToPercentInput(organization.cost_plus_markup_bp),
  ...(() => {
    const [first, second, third] = orderOf(organization);
    return { rate_order_1: first, rate_order_2: second, rate_order_3: third };
  })(),
});

function toUpdate(values: RateSettingsValues, organization: Organization): OrganizationUpdate {
  const body: OrganizationUpdate = {};
  if (values.overtime_enabled !== organization.overtime_enabled) {
    body.overtime_enabled = values.overtime_enabled;
  }
  const markup = parseMarkupToBp(values.cost_plus_markup);
  if (markup !== null && markup !== organization.cost_plus_markup_bp) {
    body.cost_plus_markup_bp = markup;
  }
  const order: RecoveryRate[] = [values.rate_order_1, values.rate_order_2, values.rate_order_3];
  if (order.join() !== orderOf(organization).join()) body.recovery_rate_order = order;
  return body;
}

/**
 * The overtime switch (APT81: overtime is a cost only, priced by the Overtime Rates of Team &
 * Rates, which replaced the multiplier); and the recovery analysis:
 * the order its recovery rate is looked for in (client job-specific, task, staff charge-out rate)
 * and the cost-plus mark-up of the practice (a client or a job can have its own). Which rates
 * price time is the WIP valuation card's (APT84), which replaced the rate mode here.
 */
export function RateModeCard({ organization, editable }: GeneralCardProps) {
  const { form, ...card } = useOrganizationForm<RateSettingsValues>({
    organization,
    schema: rateSettingsSchema,
    toValues,
    toUpdate,
    fields: FIELDS,
    fieldNames: {
      cost_plus_markup_bp: 'cost_plus_markup',
      recovery_rate_order: 'rate_order_1',
    },
    savedTitle: 'Rate settings saved',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const order = useWatch({ control, name: ['rate_order_1', 'rate_order_2', 'rate_order_3'] });

  return (
    <SettingsCard
      title="Rates"
      description="Whether overtime is tracked, and how the recovery analysis values the work. Which rates price recorded time, and in what order, is set under WIP valuation on the WIP & billing tab. Changing a rate setting never touches time that is already recorded: entries follow it when they are edited or re-rated."
      saveLabel="Save rate settings"
      editable={editable}
      dirty={card.isDirty}
      saving={card.saving}
      retryIn={card.retryIn}
      submitError={card.submitError}
      onSubmit={card.onSubmit}
      onDiscard={card.discard}
    >
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
            description="On: hours beyond a person's standard hours are overtime: staff confirm them when recording, approvers approve them, and their cost is shown on the Staff Cost report. Overtime never changes what clients are charged."
            className="rounded-md border border-border px-3 py-2"
          />
        )}
      />
      <p className="text-xs text-text-muted">
        What an hour of overtime costs is set per grade or per person in{' '}
        <Link
          to={routes.org.module(organization.slug, 'team', 'overtime-rates')}
          className="font-medium text-brand-text underline-offset-2 hover:underline"
        >
          Team &amp; Rates → Overtime Rates
        </Link>
        . Each person's standard hours are on their staff page.
      </p>
      <Input
        label="Cost-plus mark-up (%)"
        required
        inputMode="decimal"
        autoComplete="off"
        className="sm:max-w-sm"
        hint="Recovery analysis: what the work would bill at its cost plus this mark-up. 50 bills time that cost £50 an hour at £75. A client or a job can have its own mark-up, which comes first."
        error={errors.cost_plus_markup?.message}
        {...register('cost_plus_markup')}
      />
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text">Recovery rate priority</legend>
        <p className="text-xs text-text-muted">
          The recovery analysis values the work at the first of these rates that exists for it:{' '}
          {rateOrderText(order)}.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['rate_order_1', 'rate_order_2', 'rate_order_3'] as const).map((name, index) => (
            <Select
              key={name}
              label={`${PLACES[index] ?? ''} rate`}
              options={RATE_OPTIONS}
              hint={RECOVERY_RATE_HINTS[order[index] ?? 'staff']}
              error={errors[name]?.message}
              {...register(name)}
            />
          ))}
        </div>
      </fieldset>
    </SettingsCard>
  );
}
