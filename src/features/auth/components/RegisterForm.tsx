import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User as UserIcon } from 'lucide-react';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, PasswordField, useSubmitError } from '@/components/forms';
import { Button, Input } from '@/components/ui';

import { useRegister } from '../api/hooks';
import { registerSchema, type RegisterValues } from '../schemas';
import { PasswordStrength } from './PasswordStrength';

const FIELDS = ['full_name', 'email', 'password', 'password_confirm'] as const;

export interface RegisterFormProps {
  /** Called with the submitted address once the API has accepted the registration. */
  onRegistered: (email: string) => void;
  /** Pre-fills the address, for example the invited one when coming from an invitation. */
  defaultEmail?: string;
}

export function RegisterForm({ onRegistered, defaultEmail = '' }: RegisterFormProps) {
  const registerAccount = useRegister();
  const strengthId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: defaultEmail, password: '', password_confirm: '' },
  });
  const password = useWatch({ control, name: 'password' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<RegisterValues>({
      setError,
      fields: FIELDS,
    });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    registerAccount.mutate(values, {
      onSuccess: () => onRegistered(values.email),
      onError: handleSubmitError,
    });
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <Input
        label="Full name"
        autoComplete="name"
        leftIcon={<UserIcon className="size-4" />}
        placeholder="Ada Lovelace"
        error={errors.full_name?.message}
        {...register('full_name')}
      />
      <Input
        label="Work email"
        type="email"
        autoComplete="email"
        inputMode="email"
        leftIcon={<Mail className="size-4" />}
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <div className="flex flex-col gap-2.5">
        <PasswordField
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          aria-describedby={strengthId}
          {...register('password')}
        />
        <PasswordStrength id={strengthId} password={password} />
      </div>
      <PasswordField
        label="Confirm password"
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
        loading={registerAccount.isPending}
        disabled={retryIn > 0}
      >
        Create account
      </Button>
    </form>
  );
}
