import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { FormAlert, PasswordField, useSubmitError } from '@/components/forms';
import { Button, Input, useToast } from '@/components/ui';
import { routes } from '@/constants/routes';

import { useLogin } from '../api/hooks';
import { loginSchema, type LoginValues } from '../schemas';
import { ResendVerificationButton } from './ResendVerificationButton';

const FIELDS = ['email', 'password'] as const;

/**
 * Email and password sign-in. On success the session event moves the user on;
 * this form only reports failures and keeps what was typed.
 */
export interface LoginFormProps {
  /** Pre-fills the address, for example the invited one when coming from an invitation. */
  defaultEmail?: string;
  /** False where an administrator resets passwords, so there is no self-service reset. */
  showForgotPassword?: boolean;
}

export function LoginForm({ defaultEmail = '', showForgotPassword = true }: LoginFormProps = {}) {
  const login = useLogin();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<LoginValues>(
    {
      setError,
      fields: FIELDS,
    },
  );

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    login.mutate(values, {
      onSuccess: (auth) =>
        toast({ tone: 'success', title: `Welcome back, ${auth.user.full_name}` }),
      onError: handleSubmitError,
    });
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <Input
        label="Email"
        required
        type="email"
        autoComplete="email"
        inputMode="email"
        leftIcon={<Mail className="size-4" />}
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        label="Password"
        required
        autoComplete="current-password"
        error={errors.password?.message}
        labelAction={
          showForgotPassword ? (
            <Link
              to={routes.forgotPassword}
              className="rounded-sm text-sm font-medium text-primary-text hover:underline"
            >
              Forgot password?
            </Link>
          ) : undefined
        }
        {...register('password')}
      />
      {submitError ? (
        <FormAlert
          message={submitError.message}
          requestId={submitError.requestId}
          action={
            submitError.code === 'AUTH_EMAIL_NOT_VERIFIED' ? (
              <ResendVerificationButton email={getValues('email')} />
            ) : undefined
          }
        />
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={login.isPending}
        disabled={retryIn > 0}
        leftIcon={<LogIn className="size-4.5" aria-hidden="true" />}
      >
        Sign in
      </Button>
    </form>
  );
}
