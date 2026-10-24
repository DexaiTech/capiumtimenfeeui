import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, PasswordField, useSubmitError } from '@/components/forms';
import { Button, useToast } from '@/components/ui';
import { PasswordStrength } from '@/features/auth';
import { isApiError } from '@/services/api';

import { useChangePassword } from '../api/hooks';
import { changePasswordSchema, type ChangePasswordValues } from '../schemas';

const FIELDS = ['current_password', 'password', 'password_confirm'] as const;
const EMPTY: ChangePasswordValues = { current_password: '', password: '', password_confirm: '' };

export interface ChangePasswordFormProps {
  /** Label of the first field: "Temporary password" on the screen that follows a reset. */
  currentLabel?: string;
  /** Called once the password has changed (and the form has been cleared). */
  onChanged?: () => void;
}

export function ChangePasswordForm({
  currentLabel = 'Current password',
  onChanged,
}: ChangePasswordFormProps = {}) {
  const change = useChangePassword();
  const { toast } = useToast();
  const strengthId = useId();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });
  const password = useWatch({ control, name: 'password' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ChangePasswordValues>({
      setError,
      fields: FIELDS,
    });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    change.mutate(values, {
      onSuccess: () => {
        reset(EMPTY);
        toast({
          tone: 'success',
          title: 'Password changed',
          description: 'Your other sessions have been signed out.',
        });
        onChanged?.();
      },
      onError: (error) => {
        // The API answers 400 AUTH_INVALID_CREDENTIALS when the current password is wrong.
        if (isApiError(error) && error.code === 'AUTH_INVALID_CREDENTIALS') {
          setError(
            'current_password',
            { type: 'server', message: error.message },
            { shouldFocus: true },
          );
          return;
        }
        handleSubmitError(error);
      },
    });
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <PasswordField
        label={currentLabel}
        required
        autoComplete="current-password"
        error={errors.current_password?.message}
        {...register('current_password')}
      />
      <div className="flex flex-col gap-2.5">
        <PasswordField
          label="New password"
          required
          autoComplete="new-password"
          error={errors.password?.message}
          aria-describedby={strengthId}
          {...register('password')}
        />
        <PasswordStrength id={strengthId} password={password} />
      </div>
      <PasswordField
        label="Confirm new password"
        required
        autoComplete="new-password"
        error={errors.password_confirm?.message}
        {...register('password_confirm')}
      />
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={change.isPending}
          disabled={retryIn > 0}
          className="w-full sm:w-auto"
        >
          Change password
        </Button>
      </div>
    </form>
  );
}
