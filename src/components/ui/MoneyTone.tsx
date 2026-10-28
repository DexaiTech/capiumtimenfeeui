import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { moneyToneClass, type MoneyKind } from './moneyToneClass';

export interface MoneyToneProps {
  kind: MoneyKind;
  /** The amount in pence. Null, undefined and zero are not coloured (nothing is owed or paid). */
  value: number | null | undefined;
  /** The formatted amount (or a cell holding it). */
  children: ReactNode;
  className?: string;
}

/** An amount in green or red by what it means. */
export function MoneyTone({ kind, value, children, className }: MoneyToneProps) {
  return (
    <span className={cn('font-medium tabular-nums', moneyToneClass(kind, value), className)}>
      {children}
    </span>
  );
}
