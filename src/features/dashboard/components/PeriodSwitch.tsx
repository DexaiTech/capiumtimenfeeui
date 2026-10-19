import { SegmentedControl } from '@/components/ui';

import { PERIOD_OPTIONS } from '../constants';
import type { DashboardPeriod } from '../types';

export interface PeriodSwitchProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

/** This Week / This Month / Year to Date: the dashboard's period filter. */
export function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  return (
    <SegmentedControl
      label="Period"
      options={PERIOD_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
