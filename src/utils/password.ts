import { PASSWORD_MIN_LENGTH } from '@/constants/limits';

export interface PasswordHint {
  id: 'length' | 'case' | 'number' | 'symbol';
  label: string;
  met: boolean;
  /** Only required hints are enforced; the rest raise the strength score. */
  required: boolean;
}

export interface PasswordStrength {
  hints: PasswordHint[];
  /** 0 (empty) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong' | '';
}

/**
 * Strength hints for the password fields. The server's policy is length plus a
 * common-password list; the extra hints here are guidance, not rules.
 */
export function evaluatePassword(password: string): PasswordStrength {
  const hints: PasswordHint[] = [
    {
      id: 'length',
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: password.length >= PASSWORD_MIN_LENGTH,
      required: true,
    },
    {
      id: 'case',
      label: 'Upper and lower case letters',
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
      required: false,
    },
    { id: 'number', label: 'A number', met: /\d/.test(password), required: false },
    { id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(password), required: false },
  ];

  if (password.length === 0) return { hints, score: 0, label: '' };
  if (password.length < PASSWORD_MIN_LENGTH) return { hints, score: 1, label: 'Too short' };

  const extras = hints.filter((hint) => !hint.required && hint.met).length;
  const longBonus = password.length >= 16 ? 1 : 0;
  const score = Math.min(4, 1 + extras + longBonus) as 1 | 2 | 3 | 4;
  const label = (['Weak', 'Fair', 'Good', 'Strong'] as const)[score - 1] ?? 'Weak';
  return { hints, score, label };
}
