import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import type { ZodType } from 'zod';

import { useSubmitError, type SubmitError } from '@/components/forms';
import { useToast } from '@/components/ui';
import { useUpdateOrganization } from '@/features/organizations';
import { isApiError } from '@/services/api';
import type { Organization, OrganizationUpdate } from '@/types/organization';

import { renameFields } from '../utils/errors';

/** An explicit reset replaces everything, unlike the reset that follows the saved values. */
const RESET_ALL = { keepDirtyValues: false, keepErrors: false } as const;

export interface UseOrganizationFormOptions<TValues extends FieldValues> {
  organization: Organization;
  schema: ZodType<TValues, TValues>;
  /** The form values the saved practice shows. */
  toValues: (organization: Organization) => TValues;
  /** Only what changed, in the API's units (pence, minutes, basis points). */
  toUpdate: (values: TValues, organization: Organization) => OrganizationUpdate;
  /** The form fields; a 422 detail for another field becomes a form-level error. */
  fields: ReadonlyArray<Path<TValues>>;
  /** API field → form field, for 422 details (for example minutes_per_day → hours_per_day). */
  fieldNames?: Record<string, string>;
  /** The title of the success toast. */
  savedTitle: string;
}

export interface OrganizationForm<TValues extends FieldValues> {
  form: UseFormReturn<TValues>;
  onSubmit: ReturnType<UseFormReturn<TValues>['handleSubmit']>;
  /** Puts the saved values back and clears the errors. */
  discard: () => void;
  saving: boolean;
  isDirty: boolean;
  submitError: SubmitError | null;
  /** Seconds until a rate-limited save may be tried again; 0 when not limited. */
  retryIn: number;
}

/**
 * One card of the General Settings page: a form over a slice of `PATCH /organizations/{id}`.
 * The saved values flow into the fields the person has not touched, a save sends only what
 * changed, 422 details land on their fields and the card's success toast is its own.
 */
export function useOrganizationForm<TValues extends FieldValues>({
  organization,
  schema,
  toValues,
  toUpdate,
  fields,
  fieldNames = {},
  savedTitle,
}: UseOrganizationFormOptions<TValues>): OrganizationForm<TValues> {
  const update = useUpdateOrganization(organization.id);
  const { toast } = useToast();
  const form = useForm<TValues>({
    resolver: zodResolver(schema),
    values: toValues(organization),
    resetOptions: { keepDirtyValues: true, keepErrors: true },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<TValues>({
    setError: form.setError,
    fields,
  });

  const onSubmit = form.handleSubmit((values) => {
    clearSubmitError();
    const body = toUpdate(values, organization);
    if (Object.keys(body).length === 0) {
      form.reset(toValues(organization), RESET_ALL);
      return;
    }
    update.mutate(body, {
      onSuccess: (saved) => {
        form.reset(toValues(saved), RESET_ALL);
        toast({ tone: 'success', title: savedTitle });
      },
      onError: (error) => {
        if (isApiError(error) && error.status === 403) {
          toast({
            tone: 'error',
            title: 'No permission',
            description: 'Your role cannot change the practice settings.',
          });
        }
        handleSubmitError(renameFields(error, fieldNames));
      },
    });
  });

  return {
    form,
    onSubmit,
    discard: () => {
      clearSubmitError();
      form.reset(toValues(organization), RESET_ALL);
    },
    saving: update.isPending,
    isDirty: form.formState.isDirty,
    submitError,
    retryIn,
  };
}
