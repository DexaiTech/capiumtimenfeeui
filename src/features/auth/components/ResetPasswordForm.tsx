import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, PasswordField, useSubmitError } from '@/components/forms';
import { Button } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useResetPassword } from '../api/hooks';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas';
import { PasswordStrength } from './PasswordStrength';

const FIELDS = ['password', 'password_confirm'] as const;

export interface ResetPasswordFormProps {
  token: string;
  onDone: () => void;
  /** The token is unknown, used or expired. */
  onInvalidToken: () => void;
}

export function ResetPasswordForm({ token, onDone, onInvalidToken }: ResetPasswordFormProps) {
  const reset = useResetPassword();
  const strengthId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', password_confirm: '' },
  });
  const password = useWatch({ control, name: 'password' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ResetPasswordValues>({
      setError,
      fields: FIELDS,
    });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    reset.mutate(
      { token, values },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (isApiError(error) && error.code === 'TOKEN_INVALID') onInvalidToken();
          else handleSubmitError(error);
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <PasswordField
          label="New password"
          autoComplete="new-password"
          error={errors.password?.message}
          aria-describedby={strengthId}
          {...register('password')}
        />
        <PasswordStrength id={strengthId} password={password} />
      </div>
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.password_confirm?.message}
        {...register('password_confirm')}
      />
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={reset.isPending}
        disabled={retryIn > 0}
      >
        Set new password
      </Button>
    </form>
  );
}
