import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Badge, Button, Card, Input, Select, Switch, Textarea, useToast } from '@/components/ui';
import { timezoneOptions } from '@/features/account';
import { useUpdateOrganization, WEEKDAYS } from '@/features/organizations';
import { isApiError } from '@/services/api';
import {
  TIME_INCREMENTS,
  type Organization,
  type OrganizationUpdate,
  type TimeIncrement,
} from '@/types/organization';
import { cn } from '@/utils/cn';
import { hoursToMinutes, minutesToHours } from '@/utils/minutes';
import { currencySymbol, parsePounds, penceToPoundsInput } from '@/utils/money';

import { practiceSettingsSchema, type PracticeSettingsValues } from '../../schemas/practice';
import { renameFields } from '../../utils/errors';

const FIELDS = [
  'name',
  'company_number',
  'email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'country',
  'timezone',
  'week_start',
  'working_days',
  'hours_per_day',
  'vat_registered',
  'vat_number',
  'payment_terms_days',
  'default_rate',
  'time_increment_minutes',
  'require_timesheet_approval',
  'bank_details',
  'invoice_footer',
] as const;

/** API field → form field, for 422 details. */
const FIELD_NAMES = { minutes_per_day: 'hours_per_day', default_charge_rate: 'default_rate' };

/** Nullable text columns: an empty field is sent as null. */
const NULLABLE_TEXT = [
  'company_number',
  'email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'vat_number',
  'bank_details',
  'invoice_footer',
] as const;

const INCREMENT_LABELS: Record<TimeIncrement, string> = {
  1: '1 minute (exact)',
  5: '5 minutes',
  6: '6 minutes (tenths of an hour)',
  10: '10 minutes',
  15: '15 minutes (quarters)',
  30: '30 minutes',
  60: '1 hour',
};
const INCREMENT_OPTIONS = TIME_INCREMENTS.map((value) => ({
  value: String(value),
  label: INCREMENT_LABELS[value],
}));
const WEEK_START_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label }));

function toPracticeValues(organization: Organization): PracticeSettingsValues {
  return {
    name: organization.name,
    company_number: organization.company_number ?? '',
    email: organization.email ?? '',
    phone: organization.phone ?? '',
    address_line1: organization.address_line1 ?? '',
    address_line2: organization.address_line2 ?? '',
    city: organization.city ?? '',
    postcode: organization.postcode ?? '',
    country: organization.country,
    timezone: organization.timezone,
    week_start: String(organization.week_start) as PracticeSettingsValues['week_start'],
    working_days: [...organization.working_days].sort((a, b) => a - b),
    hours_per_day: minutesToHours(organization.minutes_per_day),
    vat_registered: organization.vat_registered,
    vat_number: organization.vat_number ?? '',
    payment_terms_days: String(organization.payment_terms_days),
    default_rate: penceToPoundsInput(organization.default_charge_rate, organization.currency),
    time_increment_minutes: String(organization.time_increment_minutes),
    require_timesheet_approval: organization.require_timesheet_approval,
    bank_details: organization.bank_details ?? '',
    invoice_footer: organization.invoice_footer ?? '',
  };
}

/** Only what changed, converted to the API's units (pence, minutes, numbers, null for blank). */
function toPracticeUpdate(
  values: PracticeSettingsValues,
  dirty: Partial<Record<keyof PracticeSettingsValues, unknown>>,
  organization: Organization,
): OrganizationUpdate {
  const body: OrganizationUpdate = {};
  if (dirty.name) body.name = values.name;
  for (const field of NULLABLE_TEXT) {
    if (dirty[field]) body[field] = values[field] || null;
  }
  if (dirty.country) body.country = values.country.toUpperCase();
  if (dirty.timezone) body.timezone = values.timezone;
  if (dirty.week_start) body.week_start = Number(values.week_start);
  if (dirty.working_days) body.working_days = values.working_days;
  if (dirty.hours_per_day) {
    body.minutes_per_day = hoursToMinutes(values.hours_per_day) ?? organization.minutes_per_day;
  }
  if (dirty.vat_registered) body.vat_registered = values.vat_registered;
  if (dirty.payment_terms_days) body.payment_terms_days = Number(values.payment_terms_days);
  if (dirty.default_rate) {
    const pence = parsePounds(values.default_rate, organization.currency);
    if (pence !== null && pence !== organization.default_charge_rate) {
      body.default_charge_rate = pence;
    }
  }
  if (dirty.time_increment_minutes) {
    body.time_increment_minutes = Number(values.time_increment_minutes) as TimeIncrement;
  }
  if (dirty.require_timesheet_approval) {
    body.require_timesheet_approval = values.require_timesheet_approval;
  }
  return body;
}

function FormCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function currencyLabel(currency: string): string {
  let name = currency;
  try {
    name = new Intl.DisplayNames('en-GB', { type: 'currency' }).of(currency) ?? currency;
  } catch {
    // An engine without DisplayNames shows the code alone.
  }
  return `${currency} · ${name} (${currencySymbol(currency)})`;
}

export interface PracticeSettingsFormProps {
  organization: Organization;
  /** False shows every value with the controls disabled (no `organization.update`). */
  editable: boolean;
}

/**
 * Every practice setting of `PATCH /organizations/{id}`: details, address, working week,
 * billing (VAT, payment terms, default rate), time recording and invoice text. The currency
 * is fixed when the practice is created.
 */
export function PracticeSettingsForm({ organization, editable }: PracticeSettingsFormProps) {
  const update = useUpdateOrganization(organization.id);
  const { toast } = useToast();
  const daysLabelId = useId();
  const daysErrorId = useId();
  const timezones = useMemo(() => timezoneOptions(organization.timezone), [organization.timezone]);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<PracticeSettingsValues>({
    resolver: zodResolver(practiceSettingsSchema),
    defaultValues: toPracticeValues(organization),
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<PracticeSettingsValues>({ setError, fields: FIELDS });
  const vatRegistered = useWatch({ control, name: 'vat_registered' });
  const symbol = currencySymbol(organization.currency);

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const body = toPracticeUpdate(values, dirtyFields, organization);
    if (Object.keys(body).length === 0) {
      reset(values);
      return;
    }
    update.mutate(body, {
      onSuccess: (saved) => {
        reset(toPracticeValues(saved));
        toast({ tone: 'success', title: 'Practice settings saved' });
      },
      onError: (error) => {
        if (isApiError(error) && error.status === 403) {
          toast({
            tone: 'error',
            title: 'No permission',
            description: 'Your role cannot change the practice settings.',
          });
        }
        handleSubmitError(renameFields(error, FIELD_NAMES));
      },
    });
  });

  return (
    <form
      noValidate
      aria-label="Practice settings"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-5"
    >
      <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-5">
        <FormCard
          title="Practice details"
          description="How the practice appears on invoices and statements."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Practice name"
              autoComplete="organization"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Web address"
              value={`/${organization.slug}`}
              readOnly
              disabled
              hint="Part of every link to the practice. It cannot be changed."
            />
            <Input
              label="Company number"
              autoComplete="off"
              error={errors.company_number?.message}
              {...register('company_number')}
            />
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
          </div>
        </FormCard>

        <FormCard title="Address" description="The letterhead address of invoices.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Address line 1"
              autoComplete="address-line1"
              error={errors.address_line1?.message}
              {...register('address_line1')}
            />
            <Input
              label="Address line 2"
              autoComplete="address-line2"
              error={errors.address_line2?.message}
              {...register('address_line2')}
            />
            <Input
              label="Town or city"
              autoComplete="address-level2"
              error={errors.city?.message}
              {...register('city')}
            />
            <div className="grid grid-cols-2 gap-5">
              <Input
                label="Postcode"
                autoComplete="postal-code"
                error={errors.postcode?.message}
                {...register('postcode')}
              />
              <Input
                label="Country"
                autoComplete="country"
                maxLength={2}
                hint="Two letters, e.g. GB"
                error={errors.country?.message}
                {...register('country')}
              />
            </div>
          </div>
        </FormCard>

        <FormCard
          title="Billing"
          description="VAT, payment terms and the default charge-out rate used when no other rate applies."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Currency"
              value={currencyLabel(organization.currency)}
              readOnly
              disabled
              hint="Set when the practice was created."
            />
            <Input
              label={`Default charge-out rate (${symbol} per hour)`}
              inputMode="decimal"
              autoComplete="off"
              leftIcon={<span className="text-sm">{symbol}</span>}
              error={errors.default_rate?.message}
              {...register('default_rate')}
            />
            <Input
              label="Payment terms (days)"
              inputMode="numeric"
              autoComplete="off"
              hint="Invoices fall due this many days after issue, unless the client has its own terms."
              error={errors.payment_terms_days?.message}
              {...register('payment_terms_days')}
            />
          </div>
          <Controller
            control={control}
            name="vat_registered"
            render={({ field }) => (
              <Switch
                ref={field.ref}
                checked={field.value}
                onChange={field.onChange}
                disabled={!editable}
                label="VAT registered"
                description="Off: every invoice line carries 0% VAT."
                className="rounded-md border border-border px-3 py-2"
              />
            )}
          />
          {vatRegistered ? (
            <Input
              label="VAT number"
              autoComplete="off"
              className="sm:max-w-sm"
              placeholder="GB123456789"
              error={errors.vat_number?.message}
              {...register('vat_number')}
            />
          ) : null}
        </FormCard>

        <FormCard
          title="Time recording"
          description="How time is rounded and whether timesheets need approval before billing."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Time increment"
              options={INCREMENT_OPTIONS}
              hint="Logged minutes are rounded up to this increment."
              error={errors.time_increment_minutes?.message}
              {...register('time_increment_minutes')}
            />
            <Input
              label="Hours per day"
              inputMode="decimal"
              error={errors.hours_per_day?.message}
              hint="For example 7.5. Used for capacity and utilisation."
              {...register('hours_per_day')}
            />
            <Select
              label="Timezone"
              options={timezones}
              error={errors.timezone?.message}
              {...register('timezone')}
            />
            <Select
              label="Week starts on"
              options={WEEK_START_OPTIONS}
              error={errors.week_start?.message}
              {...register('week_start')}
            />
          </div>
          <Controller
            control={control}
            name="working_days"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <span id={daysLabelId} className="text-sm font-medium text-text">
                  Working days
                </span>
                <div
                  ref={field.ref}
                  tabIndex={-1}
                  role="group"
                  aria-labelledby={daysLabelId}
                  aria-describedby={errors.working_days ? daysErrorId : undefined}
                  className="grid grid-cols-7 gap-1 sm:flex sm:flex-wrap sm:gap-2"
                >
                  {WEEKDAYS.map((day) => {
                    const pressed = field.value.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={pressed}
                        aria-label={day.label}
                        onClick={() =>
                          field.onChange(
                            pressed
                              ? field.value.filter((value) => value !== day.value)
                              : [...field.value, day.value].sort((a, b) => a - b),
                          )
                        }
                        onBlur={field.onBlur}
                        className={cn(
                          'flex h-11 items-center justify-center rounded-md border text-sm font-medium sm:w-14 md:h-9',
                          'transition-colors duration-fast ease-standard disabled:opacity-60',
                          pressed
                            ? 'border-brand bg-brand-soft text-brand-text'
                            : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text',
                        )}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
                {errors.working_days ? (
                  <p id={daysErrorId} role="alert" className="text-xs font-medium text-danger">
                    {errors.working_days.message}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="require_timesheet_approval"
            render={({ field }) => (
              <Switch
                ref={field.ref}
                checked={field.value}
                onChange={field.onChange}
                disabled={!editable}
                label="Timesheet approval"
                description="On: only time on approved timesheets can be billed."
                className="rounded-md border border-border px-3 py-2"
              />
            )}
          />
        </FormCard>

        <FormCard title="Invoices" description="Printed on every invoice PDF.">
          <Textarea
            label="Bank details"
            rows={3}
            placeholder={'Bank name\nSort code 00-00-00 · Account 12345678'}
            hint="Where clients pay. At most 500 characters."
            error={errors.bank_details?.message}
            {...register('bank_details')}
          />
          <Textarea
            label="Invoice footer"
            rows={3}
            hint="For example the registered office and regulatory wording. At most 1000 characters."
            error={errors.invoice_footer?.message}
            {...register('invoice_footer')}
          />
        </FormCard>
      </fieldset>

      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}

      {editable ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-2 rounded-xl border border-border bg-surface/95 p-3 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-end">
          {isDirty ? (
            <span className="mr-auto hidden text-sm text-text-muted sm:inline">
              You have unsaved changes.
            </span>
          ) : null}
          <Button
            disabled={!isDirty || update.isPending}
            onClick={() => {
              clearSubmitError();
              reset(toPracticeValues(organization));
            }}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={update.isPending}
            disabled={!isDirty || retryIn > 0}
          >
            Save changes
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Badge tone="grey">Read only</Badge>
          Only roles that manage the practice can change these settings.
        </p>
      )}
    </form>
  );
}
