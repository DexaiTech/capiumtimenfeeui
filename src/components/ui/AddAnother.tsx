import type { RefObject } from 'react';

import { Button, type ButtonProps } from './Button';

export interface AddAnotherButtonProps extends Omit<ButtonProps, 'type' | 'form' | 'onClick'> {
  formId: string;
  /** The `flagRef` of `useAddAnother`. */
  flagRef: RefObject<boolean>;
}

/** The second submit button of a create form: saves, then keeps the form open for the next one. */
export function AddAnotherButton({
  formId,
  flagRef,
  children = 'Save and add another',
  ...rest
}: AddAnotherButtonProps) {
  return (
    <Button
      type="submit"
      form={formId}
      onClick={() => {
        flagRef.current = true;
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}
