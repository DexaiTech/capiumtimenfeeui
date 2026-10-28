import { Check } from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/utils/cn';

import { ACCENT_PRESETS, isHexColor } from '../../utils/templates';

export interface AccentColorFieldProps {
  /** `#RRGGBB`, or '' for the plain black and grey look. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** The colour of the title, the practice name and the table headings: a few swatches, any colour
 * from the colour picker, or none. */
export function AccentColorField({ value, onChange, error }: AccentColorFieldProps) {
  const labelId = useId();
  const picked = isHexColor(value) ? value : '#694BAF';
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-text">
        Colour
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="No colour"
          aria-pressed={value === ''}
          onClick={() => onChange('')}
          className={cn(
            'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium',
            value === ''
              ? 'border-primary bg-primary-soft text-primary-text'
              : 'border-border text-text-muted hover:bg-surface-hover',
          )}
        >
          None
        </button>
        {ACCENT_PRESETS.map((preset) => {
          const on = value.toLowerCase() === preset.color.toLowerCase();
          return (
            <button
              key={preset.color}
              type="button"
              aria-label={preset.name}
              aria-pressed={on}
              title={preset.name}
              onClick={() => onChange(preset.color)}
              style={{ backgroundColor: preset.color }}
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-surface',
                on && 'ring-2 ring-primary',
              )}
            >
              {on ? <Check aria-hidden="true" className="size-4" /> : null}
            </button>
          );
        })}
        <label className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <input
            type="color"
            aria-label="Choose another colour"
            value={picked}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="h-7 w-9 cursor-pointer rounded-sm border border-border bg-surface p-0.5"
          />
          {isHexColor(value) ? value.toUpperCase() : 'Other'}
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          Used for the title, the practice name and the table headings of the invoice.
        </p>
      )}
    </div>
  );
}
