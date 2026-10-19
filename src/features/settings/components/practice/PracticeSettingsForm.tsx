import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Badge, Button, Card, Input, Switch, Tabs, Textarea, useToast } from '@/components/ui';
import { ORG_SEGMENTS, modulePath } from '@/constants/routes';
import { useUpdateOrganization } from '@/features/organizations';
import { isApiError } from '@/services/api';
import type { Organization, OrganizationUpdate } from '@/types/organization';
import { cn } from '@/utils/cn';
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
  'vat_registered',
  'vat_number',
  'payment_terms_days',
  'default_rate',
  'bank_details',
  'invoice_footer',
] as const;

/** API field → form field, for 422 details. */
const FIELD_NAMES = { default_charge_rate: 'default_rate' };

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

type PracticeTab = 'details' | 'address' | 'billing' | 'invoices';

const TABS: ReadonlyArray<{ value: PracticeTab; label: string }> = [
  { value: 'details', label: 'Details' },
  { value: 'address', label: 'Address' },
  { value: 'billing', label: 'Billing' },
  { value: 'invoices', label: 'Invoices' },
];

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
    vat_registered: organization.vat_registered,
    vat_number: organization.vat_number ?? '',
    payment_terms_days: String(organization.payment_terms_days),
    default_rate: penceToPoundsInput(organization.default_charge_rate, organization.currency),
    bank_details: organization.bank_details ?? '',
    invoice_footer: organization.invoice_footer ?? '',
  };
}

/** Only what changed, converted to the API's units (pence, numbers, null for blank). */
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
  if (dirty.vat_registered) body.vat_registered = values.vat_registered;
  if (dirty.payment_terms_days) body.payment_terms_days = Number(values.payment_terms_days);
  if (dirty.default_rate) {
    const pence = parsePounds(values.default_rate, organization.currency);
    if (pence !== null && pence !== organization.default_charge_rate) {
      body.default_charge_rate = pence;
    }
  }
  return body;
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
 * Every practice setting of `PATCH /organizations/{id}` except time recording, which moved to
 * General Settings (`TimeSettingsCard`) so it is edited in one place only: details, address,
 * billing (VAT, payment terms, default rate) and invoice text, one tab each.
 */
export function PracticeSettingsForm({ organization, editable }: PracticeSettingsFormProps) {
  const update = useUpdateOrganization(organization.id);
  const { toast } = useToast();
  const [tab, setTab] = useState<PracticeTab>('details');
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
      <Card padding="none" className="flex flex-col gap-1 border-border bg-surface-sunken p-4">
        <p className="flex items-center gap-2 text-sm text-text">
          <span aria-hidden="true">↗</span>
          <span>
            Time recording settings have moved to{' '}
            <Link
              to={modulePath(organization.slug, ORG_SEGMENTS.settings, 'general')}
              className="font-medium text-brand-text underline-offset-2 hover:underline"
            >
              General Settings
            </Link>
            .
          </span>
        </p>
        <p className="text-xs text-text-muted">
          Time increment, working days, daily target and timesheet approval are now edited in one
          place only.
        </p>
      </Card>

      <Tabs label="Practice settings section" idBase="practice-settings" items={TABS} value={tab} onChange={setTab} />

      <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-5">
        <div
          role="tabpanel"
          id="practice-settings-panel-details"
          aria-labelledby="practice-settings-tab-details"
          className={cn('flex flex-col gap-5', tab !== 'details' && 'hidden')}
        >
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text">Practice details</h2>
              <p className="text-sm text-text-muted">
                How the practice appears on invoices and statements.
              </p>
            </div>
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
          </Card>
        </div>

        <div
          role="tabpanel"
          id="practice-settings-panel-address"
          aria-labelledby="practice-settings-tab-address"
          className={cn('flex flex-col gap-5', tab !== 'address' && 'hidden')}
        >
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text">Address</h2>
              <p className="text-sm text-text-muted">The letterhead address of invoices.</p>
            </div>
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
          </Card>
        </div>

        <div
          role="tabpanel"
          id="practice-settings-panel-billing"
          aria-labelledby="practice-settings-tab-billing"
          className={cn('flex flex-col gap-5', tab !== 'billing' && 'hidden')}
        >
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text">Billing</h2>
              <p className="text-sm text-text-muted">
                VAT, payment terms and the default charge-out rate used when no other rate
                applies.
              </p>
            </div>
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
          </Card>
        </div>

        <div
          role="tabpanel"
          id="practice-settings-panel-invoices"
          aria-labelledby="practice-settings-tab-invoices"
          className={cn('flex flex-col gap-5', tab !== 'invoices' && 'hidden')}
        >
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text">Invoices</h2>
              <p className="text-sm text-text-muted">Printed on every invoice PDF.</p>
            </div>
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
          </Card>
        </div>
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
