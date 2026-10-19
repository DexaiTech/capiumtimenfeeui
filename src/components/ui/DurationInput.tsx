import { useState, type Ref } from 'react';

import { formatMinutes, parseMinutes } from '@/utils/minutes';
import { Input, type InputProps } from './Input';

export interface DurationInputProps extends Omit<
  InputProps,
  'value' | 'onChange' | 'type' | 'defaultValue' | 'error'
> {
  /** Minutes, or null for "not set". */
  value: number | null;
  /** Called on blur or Enter with the parsed minutes, only when they changed. */
  onCommit: (minutes: number | null) => void;
  /** Largest accepted value in minutes. */
  max?: number;
  /** An error from outside (for example the server's), shown when the text itself is valid. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** A text field for a duration in minutes: type "1:30", "1.5" (hours) or "1h 30m"; shown as h:mm. */
export function DurationInput({
  value,
  onCommit,
  max,
  error,
  placeholder = 'h:mm',
  ...rest
}: DurationInputProps) {
  // The text while the user is typing; null shows the formatted value.
  const [text, setText] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  const commit = () => {
    if (text === null) return;
    const empty = text.trim() === '';
    const minutes = empty ? null : parseMinutes(text);
    if (!empty && minutes === null) {
      setInvalid('Use a duration like 1:30, 1.5 or 1h 30m.');
      return;
    }
    if (minutes !== null && max !== undefined && minutes > max) {
      setInvalid(`The most that can be entered is ${formatMinutes(max)}.`);
      return;
    }
    setInvalid(null);
    setText(null);
    if (minutes !== value) onCommit(minutes);
  };

  return (
    <Input
      {...rest}
      type="text"
      inputMode="text"
      autoComplete="off"
      placeholder={placeholder}
      value={text ?? formatMinutes(value)}
      error={invalid ?? error}
      onChange={(event) => {
        setText(event.target.value);
        setInvalid(null);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape' && text !== null) {
          event.stopPropagation();
          setText(null);
          setInvalid(null);
        }
      }}
    />
  );
}
