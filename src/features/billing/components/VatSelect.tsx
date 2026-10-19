import { Select, type SelectProps } from '@/components/ui';
import { formatBasisPoints } from '@/utils/money';

import type { VatOption } from '../types';
import { vatLabel } from '../utils/format';

export interface VatSelectProps extends Omit<SelectProps, 'options' | 'label' | 'placeholder'> {
  options: ReadonlyArray<VatOption>;
  label?: string;
  /** Offers "Default" (value ''): the API then applies the client's or the practice's code. */
  defaultLabel?: string;
  /** A code the line already has that is no longer offered (archived): kept so it still shows. */
  current?: { id: string; rate_bp: number } | null;
}

/** The practice's VAT codes (Standard, Reduced, Zero, Exempt, Outside scope, …) as a native select. */
export function VatSelect({
  options,
  label = 'VAT code',
  defaultLabel,
  current,
  ...rest
}: VatSelectProps) {
  const items = options.map((option) => ({ value: option.id, label: vatLabel(option) }));
  if (current && !options.some((option) => option.id === current.id)) {
    items.push({ value: current.id, label: `Archived code (${formatBasisPoints(current.rate_bp)})` });
  }
  return (
    <Select
      label={label}
      options={defaultLabel ? [{ value: '', label: defaultLabel }, ...items] : items}
      {...rest}
    />
  );
}
