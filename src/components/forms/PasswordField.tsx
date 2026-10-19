import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { Input, type InputProps } from '@/components/ui';

export type PasswordFieldProps = Omit<InputProps, 'type' | 'rightSlot'>;

/** Password input with a show/hide toggle. */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      rightSlot={
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          className="flex size-10 items-center justify-center rounded-sm text-text-subtle hover:text-text md:size-8"
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </button>
      }
    />
  );
}
