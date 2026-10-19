import { cn } from '@/utils/cn';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  /** Accessible name; shown above the bar unless `hideLabel` is set. */
  label: string;
  hideLabel?: boolean;
  /** Text alternative for the value (for example "Good"). Defaults to the percentage. */
  valueText?: string;
  className?: string;
}

const tones: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  label,
  hideLabel = false,
  valueText,
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {hideLabel ? null : (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{label}</span>
          <span>{valueText ?? `${percent}%`}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-base ease-standard',
            tones[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
