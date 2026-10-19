import { Check, Circle } from 'lucide-react';

import { ProgressBar, type ProgressTone } from '@/components/ui';
import { cn } from '@/utils/cn';
import { evaluatePassword } from '@/utils/password';

export interface PasswordStrengthProps {
  password: string;
  /** Id for `aria-describedby` on the password input. */
  id?: string;
}

const tones: Record<number, ProgressTone> = {
  0: 'danger',
  1: 'danger',
  2: 'warning',
  3: 'info',
  4: 'success',
};

/** Strength meter and hint checklist. State is conveyed by icon and text, not colour alone. */
export function PasswordStrength({ password, id }: PasswordStrengthProps) {
  const { hints, score, label } = evaluatePassword(password);

  return (
    <div id={id} className="flex flex-col gap-2">
      <ProgressBar
        label="Password strength"
        value={score}
        max={4}
        tone={tones[score] ?? 'danger'}
        valueText={label || 'Not entered'}
      />
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {hints.map((hint) => (
          <li
            key={hint.id}
            className={cn(
              'flex items-center gap-1.5',
              hint.met ? 'text-success' : 'text-text-muted',
            )}
          >
            {hint.met ? (
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {hint.label}
              <span className="sr-only">{hint.met ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
