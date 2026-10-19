import { cn } from '@/utils/cn';

import { healthTone } from './health';

export interface HealthBarProps {
  /** Score out of 100; clamped. `null` shows a dash. */
  score: number | null;
  /** Accessible name, for example "Client health". */
  label?: string;
  /** Hide the "84/100" text and show the bar only. */
  hideValue?: boolean;
  className?: string;
}

const fills = {
  good: 'bg-health-good',
  fair: 'bg-health-fair',
  poor: 'bg-health-poor',
} as const;

/** A score out of 100 with a short horizontal bar ("84/100 ▬▬▬▬▬▬▬▬░░"). */
export function HealthBar({
  score,
  label = 'Health',
  hideValue = false,
  className,
}: HealthBarProps) {
  if (score === null || !Number.isFinite(score)) {
    return <span className={cn('text-text-subtle', className)}>—</span>;
  }
  const value = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <span className={cn('inline-flex max-w-full items-center gap-2', className)}>
      {hideValue ? null : (
        <span className="w-12 text-xs font-medium text-text tabular-nums">
          {value}
          <span className="text-text-subtle">/100</span>
        </span>
      )}
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="relative h-1.5 w-20 overflow-hidden rounded-full bg-health-track"
      >
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full', fills[healthTone(value)])}
          style={{ width: `${value}%` }}
        />
      </span>
    </span>
  );
}
