import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Link2 } from 'lucide-react';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Select } from '@/components/ui';
import { browserTimezone, timezoneOptions } from '@/features/account';
import { isApiError } from '@/services/api';
import type { OrganizationContext } from '@/types/organization';

import { useCreateOrganization } from '../api/hooks';
import { createOrganizationSchema, type CreateOrganizationValues } from '../schemas';
import { conflictOnField } from '../utils/errors';
import { slugify } from '../utils/slug';

const FIELDS = ['name', 'slug', 'timezone'] as const;

export interface CreateOrganizationFormProps {
  /** Called with the new practice (the caller is its Owner). */
  onCreated: (context: OrganizationContext) => void;
}

export function CreateOrganizationForm({ onCreated }: CreateOrganizationFormProps) {
  const create = useCreateOrganization();
  const detected = useMemo(() => browserTimezone(), []);
  const options = useMemo(() => timezoneOptions(detected), [detected]);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: '', slug: '', timezone: detected },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<CreateOrganizationValues>({ setError, fields: FIELDS });

  const [name, slug] = useWatch({ control, name: ['name', 'slug'] });
  const derivedSlug = slugify(name);
  const previewSlug = slug.trim() || derivedSlug;

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    create.mutate(
      {
        name: values.name,
        timezone: values.timezone,
        // Omitted when empty, so the API derives a unique slug from the name.
        ...(values.slug ? { slug: values.slug } : {}),
      },
      {
        onSuccess: onCreated,
        onError: (error) => {
          const taken = isApiError(error) ? conflictOnField(error, 'slug') : null;
          if (taken) {
            clearSubmitError();
            setError('slug', { type: 'server', message: taken.message }, { shouldFocus: true });
            return;
          }
          handleSubmitError(error);
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <Input
        label="Practice name"
        required
        autoComplete="organization"
        leftIcon={<Building2 className="size-4" />}
        placeholder="Smith & Co Accountants"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="URL name (optional)"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        leftIcon={<Link2 className="size-4" />}
        placeholder={derivedSlug || 'acme-inc'}
        error={errors.slug?.message}
        hint={
          derivedSlug
            ? `Leave empty to use “${derivedSlug}”, derived from the name. It cannot be changed later.`
            : 'Lowercase letters, numbers and hyphens. It cannot be changed later.'
        }
        {...register('slug')}
      />
      <div
        aria-live="polite"
        className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2.5"
      >
        <span className="text-xs text-text-muted">Your practice’s address</span>
        <span className="font-mono text-sm break-all text-text">
          <span className="text-text-subtle">{window.location.host}/</span>
          {previewSlug || 'your-practice'}
        </span>
      </div>
      <Select
        label="Timezone"
        options={options}
        error={errors.timezone?.message}
        hint="Used for timesheets, due dates and reports. You can change it in the settings."
        {...register('timezone')}
      />
      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={create.isPending}
        disabled={retryIn > 0}
      >
        Create practice
      </Button>
    </form>
  );
}
