import { Input } from '@/components/ui';
import type { Organization, OrganizationUpdate } from '@/types/organization';
import { currencySymbol, parsePounds, penceToPoundsInput } from '@/utils/money';

import { useOrganizationForm } from '../../hooks/useOrganizationForm';
import { expenseSettingsSchema, type ExpenseSettingsValues } from '../../schemas/general';
import { parseMarkupToBp } from '../../utils/general';
import { bpToPercentInput } from '../../utils/vat';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';

const FIELDS = ['mileage_rate', 'expense_markup', 'receipt_required_threshold'] as const;
/** API field → form field, for 422 details. */
const FIELD_NAMES = { expense_markup_bp: 'expense_markup' };

function toValues(organization: Organization): ExpenseSettingsValues {
  return {
    mileage_rate: penceToPoundsInput(organization.mileage_rate, organization.currency),
    expense_markup: bpToPercentInput(organization.expense_markup_bp),
    receipt_required_threshold: penceToPoundsInput(
      organization.receipt_required_threshold,
      organization.currency,
    ),
  };
}

function toUpdate(values: ExpenseSettingsValues, organization: Organization): OrganizationUpdate {
  const body: OrganizationUpdate = {};
  const mileage = parsePounds(values.mileage_rate, organization.currency);
  if (mileage !== null && mileage !== organization.mileage_rate) body.mileage_rate = mileage;
  const markup = parseMarkupToBp(values.expense_markup);
  if (markup !== null && markup !== organization.expense_markup_bp) {
    body.expense_markup_bp = markup;
  }
  const receipt = parsePounds(values.receipt_required_threshold, organization.currency);
  if (receipt !== null && receipt !== organization.receipt_required_threshold) {
    body.receipt_required_threshold = receipt;
  }
  return body;
}

/** `mileage_rate`, `expense_markup_bp` and `receipt_required_threshold`. */
export function ExpenseSettingsCard({ organization, editable }: GeneralCardProps) {
  const { form, ...card } = useOrganizationForm<ExpenseSettingsValues>({
    organization,
    schema: expenseSettingsSchema,
    toValues,
    toUpdate,
    fields: FIELDS,
    fieldNames: FIELD_NAMES,
    savedTitle: 'Expense settings saved',
  });
  const {
    register,
    formState: { errors },
  } = form;
  const symbol = currencySymbol(organization.currency);

  return (
    <SettingsCard
      title="Expenses"
      description="The mileage rate, the mark-up added when an expense is recharged and when a receipt is required."
      saveLabel="Save expense settings"
      editable={editable}
      dirty={card.isDirty}
      saving={card.saving}
      retryIn={card.retryIn}
      submitError={card.submitError}
      onSubmit={card.onSubmit}
      onDiscard={card.discard}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Input
          label={`Mileage rate (${symbol} per mile)`}
          inputMode="decimal"
          autoComplete="off"
          leftIcon={<span className="text-sm">{symbol}</span>}
          hint="The rate a mileage expense is priced at, up to 10.00."
          error={errors.mileage_rate?.message}
          {...register('mileage_rate')}
        />
        <Input
          label="Expense mark-up (%)"
          inputMode="decimal"
          autoComplete="off"
          hint="Added when an expense is recharged to the client. 0 adds nothing."
          error={errors.expense_markup?.message}
          {...register('expense_markup')}
        />
        <Input
          label={`Receipt required above (${symbol})`}
          inputMode="decimal"
          autoComplete="off"
          leftIcon={<span className="text-sm">{symbol}</span>}
          hint="An expense above this gross amount must carry a receipt. 0 means every expense does."
          error={errors.receipt_required_threshold?.message}
          {...register('receipt_required_threshold')}
        />
      </div>
    </SettingsCard>
  );
}
