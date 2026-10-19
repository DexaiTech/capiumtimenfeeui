import { HorizontalBarList, type HorizontalBarItem } from '@/components/charts';
import { formatMoney } from '@/utils/money';

import { AGEING_BUCKETS } from '../constants';
import type { WipAgeing } from '../types';

export interface WipAgeingCardProps {
  ageing: WipAgeing;
  currency: string;
  className?: string;
}

/** WIP by the age of its items: four bars, newest first, from the charts kit. */
export function WipAgeingCard({ ageing, currency, className }: WipAgeingCardProps) {
  const items: HorizontalBarItem[] = AGEING_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: ageing[bucket.key],
    color: bucket.color,
  }));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <HorizontalBarList
      title="WIP ageing"
      items={total > 0 ? items : []}
      valueFormatter={(value) => formatMoney(value, currency)}
      emptyTitle="No work in progress"
      emptyDescription="Unbilled time and expenses appear here by age."
      className={className}
    />
  );
}
