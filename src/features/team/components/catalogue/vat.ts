import type { SelectOption } from '@/components/ui';
import { formatBasisPoints } from '@/utils/money';

import type { VatCode } from '../../types';

/**
 * The choices of a VAT select: "no default", the live VAT codes, and the one the record already
 * has when it is no longer in the list (archived since), so that saving never drops it unseen.
 */
export function vatOptions(
  codes: ReadonlyArray<VatCode> | undefined,
  current: string | null,
): SelectOption[] {
  const options: SelectOption[] = [{ value: '', label: 'No default VAT code' }];
  for (const code of codes ?? []) {
    if (code.is_archived && code.id !== current) continue;
    options.push({
      value: code.id,
      label: `${code.name} (${formatBasisPoints(code.rate_bp)})${code.is_archived ? ' · archived' : ''}`,
    });
  }
  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: 'Current VAT code' });
  }
  return options;
}

/** A VAT code as shown in a table: its name, or a dash. */
export function vatName(codes: ReadonlyArray<VatCode> | undefined, id: string | null): string {
  if (!id) return '—';
  return codes?.find((code) => code.id === id)?.name ?? '—';
}
