import { TriangleAlert } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';

import { Input, Select, Switch } from '@/components/ui';
import type { RecoveryRate } from '@/types';
import type { Organization, OrganizationUpdate } from '@/types/organization';
import { bpToMultiplierInput, parseMultiplierToBp } from '@/utils/multiplier';
import {
  RECOVERY_RATE_HINTS,
  RECOVERY_RATE_LABELS,
  RECOVERY_RATES,
  rateOrderText,
} from '@/utils/recovery';

import { useStaffWithoutOwnRate } from '../../api/rateModeHooks';
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
  rate_mode: organization.rate_mode,
  overtime_enabled: organization.overtime_enabled,
  overtime_multiplier: bpToMultiplierInput(organization.overtime_multiplier_bp),
  cost_plus_markup: bpToPercentInput(organization.cost_plus_markup_bp),
  ...(() => {
    const [first, second, third] = orderOf(organization);
    return { rate_order_1: first, rate_order_2: second, rate_order_3: third };
  })(),
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
  const order: RecoveryRate[] = [values.rate_order_1, values.rate_order_2, values.rate_order_3];
  if (order.join() !== orderOf(organization).join()) body.recovery_rate_order = order;
  return body;
}

/** How many names the staff-rates-only warning lists before "and N more". */
const NAMES_SHOWN = 5;

/**
 * Under "Staff rates only" a person's grade rate is not used (APT79): names the active staff who
 * have no charge-out rate of their own, so nobody is priced at the practice default unnoticed.
 */
function StaffWithoutOwnRate() {
  const missing = useStaffWithoutOwnRate(true);
  const people = missing.data ?? [];
  if (people.length === 0) return null;
  const names = people.slice(0, NAMES_SHOWN).map((person) => person.full_name);
  const more = people.length - names.length;
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-text sm:max-w-md"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>
        {people.length === 1 ? '1 person has' : `${people.length} people have`} no charge-out rate
        of their own and would be priced at the practice default rate: {names.join(', ')}
        {more > 0 ? ` and ${more} more` : ''}. Add their rates in Team &amp; Rates, Charge-out
        Rates.
      </span>
    </p>
  );
}

/**
 * `rate_mode`: staff rate first, grade rates only or staff rates only; the overtime
 * switch with the multiplier overtime time is priced at; and the recovery analysis: the order its
 * recovery rate is looked for in (client job-specific, task, staff charge-out rate) and the
 * cost-plus mark-up of the practice (a client or a job can have its own).
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
      recovery_rate_order: 'rate_order_1',
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
  const order = useWatch({ control, name: ['rate_order_1', 'rate_order_2', 'rate_order_3'] });

  return (
    <SettingsCard
      title="Rates"
      description="Which charge-out rates price recorded time, whether overtime is paid at a premium, and how the recovery analysis values the work. Changing a rate setting never touches time that is already recorded: entries follow it when they are edited or re-rated."
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
      {mode === 'staff_only' ? <StaffWithoutOwnRate /> : null}
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
