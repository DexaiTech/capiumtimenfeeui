import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Select, useToast } from '@/components/ui';
import type { User } from '@/types/models';

import { useUpdateProfile } from '../api/hooks';
import { profileSchema, type ProfileValues } from '../schemas';
import { browserTimezone, timezoneOptions } from '../timezones';

const FIELDS = ['full_name', 'timezone'] as const;

export interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const update = useUpdateProfile();
  const { toast } = useToast();
  const options = useMemo(() => timezoneOptions(user.timezone), [user.timezone]);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user.full_name, timezone: user.timezone },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<ProfileValues>({
      setError,
      fields: FIELDS,
    });
  const detected = browserTimezone();

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    update.mutate(values, {
      onSuccess: (saved) => {
        reset({ full_name: saved.full_name, timezone: saved.timezone });
        toast({ tone: 'success', title: 'Profile updated' });
      },
      onError: handleSubmitError,
    });
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <Input
        label="Email"
        type="email"
        value={user.email}
        readOnly
        disabled
        hint="Your sign-in address."
      />
      <Input
        label="Full name"
        required
        autoComplete="name"
        error={errors.full_name?.message}
        {...register('full_name')}
      />
      <Select
        label="Timezone"
        options={options}
        error={errors.timezone?.message}
        hint={
          detected !== user.timezone ? (
            <>
              Your browser reports {detected.replaceAll('_', ' ')}.{' '}
              <button
                type="button"
                className="rounded-sm font-medium text-primary-text hover:underline"
                onClick={() =>
                  setValue('timezone', detected, { shouldDirty: true, shouldValidate: true })
                }
              >
                Use it
              </button>
            </>
          ) : (
            'Dates and reminders are shown in this timezone.'
          )
        }
        {...register('timezone')}
      />
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={update.isPending}
          disabled={!isDirty || retryIn > 0}
          className="w-full sm:w-auto"
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
