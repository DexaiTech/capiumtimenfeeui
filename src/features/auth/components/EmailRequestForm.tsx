import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input } from '@/components/ui';

import { emailOnlySchema, type EmailOnlyValues } from '../schemas';

const FIELDS = ['email'] as const;

export interface EmailRequestFormProps {
  submitLabel: string;
  /** Sends the request; rejects with the API error on failure. */
  onSubmitEmail: (email: string) => Promise<unknown>;
  /** Called after the API accepted the request (always, by design: no account enumeration). */
  onSent: (email: string) => void;
}

/** One email field and a submit button: shared by "forgot password" and "resend verification". */
export function EmailRequestForm({ submitLabel, onSubmitEmail, onSent }: EmailRequestFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<EmailOnlyValues>({
      setError,
      fields: FIELDS,
    });

  const onSubmit = handleSubmit(async ({ email }) => {
    clearSubmitError();
    try {
      await onSubmitEmail(email);
      onSent(email);
    } catch (error) {
      handleSubmitError(error);
    }
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4 text-left"
    >
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
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={isSubmitting}
        disabled={retryIn > 0}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
