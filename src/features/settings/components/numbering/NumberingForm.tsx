import { zodResolver } from '@hookform/resolvers/zod';
import { Hash } from 'lucide-react';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Badge, Button, Card, EmptyState, Input, Skeleton, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';

import { useSequences, useUpdateSequence } from '../../api/billingHooks';
import type { NumberedDocument, Sequence, SequenceUpdate } from '../../billingTypes';
import { numberingSchema, type NumberingValues } from '../../schemas/billing';
import { toBillingFormError } from '../../utils/billingErrors';
import {
  FORWARD_ONLY,
  NUMBERED_DOCUMENTS,
  PADDING_MAX,
  PADDING_MIN,
  PREFIX_MAX_LENGTH,
  previewNumbers,
  type NumberedDocumentInfo,
} from '../../utils/numbering';
import { LoadError } from '../LoadError';

const FIELDS = ['prefix', 'suffix', 'padding', 'next_number'] as const;

/** An explicit reset replaces everything, unlike the reset that follows the saved numbering. */
const RESET_ALL = { keepDirtyValues: false, keepErrors: false } as const;

const toValues = (sequence: Sequence): NumberingValues => ({
  prefix: sequence.prefix,
  suffix: sequence.suffix ?? '',
  padding: String(sequence.padding),
  next_number: String(sequence.next_number),
});

function NumberingSkeleton({ label }: { label: string }) {
  return (
    <Card padding="lg" role="status" aria-label={label} className="flex flex-col gap-5">
      <Skeleton shape="rect" className="h-24 w-full" />
      <div className="grid gap-5 sm:grid-cols-3">
        <Skeleton shape="rect" className="h-14 w-full" />
        <Skeleton shape="rect" className="h-14 w-full" />
        <Skeleton shape="rect" className="h-14 w-full" />
      </div>
    </Card>
  );
}

/** What the page shows when the API has no sequence of the kind (estimates, until it has). */
function NotAvailable({ kind, info }: { kind: NumberedDocument; info: NumberedDocumentInfo }) {
  return (
    <Card padding="none">
      <EmptyState
        icon={<Hash className="size-6" />}
        title={`${info.title} is not available yet`}
        description={
          kind === 'estimate'
            ? 'Estimates are still being added to the application. Their numbering appears here as soon as the practice has it.'
            : `The numbering of ${info.plural} could not be found for this practice.`
        }
      />
    </Card>
  );
}

function NumberingEditor({ kind, sequence }: { kind: NumberedDocument; sequence: Sequence }) {
  const { can } = useOrg();
  const { toast } = useToast();
  const update = useUpdateSequence();
  const info = NUMBERED_DOCUMENTS[kind];
  const editable = can(PERMISSIONS.organizationUpdate);
  const forwardOnly = FORWARD_ONLY.has(kind);
  const schema = useMemo(
    () => numberingSchema(forwardOnly ? sequence.next_number : null),
    [forwardOnly, sequence.next_number],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<NumberingValues>({
    resolver: zodResolver(schema),
    // The saved numbering flows into the fields the person has not touched; a refused number
    // keeps its message while the sequence is refetched.
    values: toValues(sequence),
    resetOptions: { keepDirtyValues: true, keepErrors: true },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<NumberingValues>({ setError, fields: FIELDS });
  const draft = useWatch({ control });
  const upcoming = previewNumbers(
    {
      prefix: draft.prefix ?? '',
      suffix: draft.suffix ?? '',
      padding: draft.padding ?? '',
      next_number: draft.next_number ?? '',
    },
    3,
  );

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    // PATCH is partial: send only what changed.
    const body: SequenceUpdate = {};
    if (values.prefix !== sequence.prefix) body.prefix = values.prefix;
    if (values.suffix !== (sequence.suffix ?? '')) body.suffix = values.suffix;
    if (Number(values.padding) !== sequence.padding) body.padding = Number(values.padding);
    if (Number(values.next_number) !== sequence.next_number) {
      body.next_number = Number(values.next_number);
    }
    if (Object.keys(body).length === 0) {
      reset(toValues(sequence), RESET_ALL);
      return;
    }
    update.mutate(
      { kind, body },
      {
        onSuccess: (saved) => {
          reset(toValues(saved), RESET_ALL);
          toast({ tone: 'success', title: `${info.title} saved` });
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 403) {
            toast({
              tone: 'error',
              title: 'No permission',
              description: 'Your role cannot change the numbering.',
            });
          }
          handleSubmitError(toBillingFormError(error));
        },
      },
    );
  });

  return (
    <form
      noValidate
      aria-label={info.title}
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-5"
    >
      <Card padding="lg" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-text">Number format</h2>
          <p className="text-sm text-text-muted">
            How the numbers of {info.plural} look, and where the count carries on from.
          </p>
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
          className="flex flex-col gap-1 rounded-xl border border-border bg-surface-sunken px-5 py-4"
        >
          <span className="text-xs font-medium text-text-muted">Next {info.noun} number</span>
          {upcoming ? (
            <span className="font-mono text-2xl font-semibold text-text tabular-nums">
              {upcoming[0]}
            </span>
          ) : (
            <span className="text-2xl font-semibold text-text-subtle">—</span>
          )}
          <span className="text-xs text-text-muted">
            {upcoming
              ? `Then ${upcoming[1] ?? ''}, ${upcoming[2] ?? ''} and so on.`
              : 'Correct the fields marked below to see the next number.'}
            {isDirty ? ` Saved now: ${sequence.preview}.` : null}
          </span>
        </div>

        <fieldset disabled={!editable} className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Prefix"
            autoComplete="off"
            placeholder="e.g. INV-"
            maxLength={PREFIX_MAX_LENGTH}
            hint={`Before the number. Up to ${PREFIX_MAX_LENGTH} letters, digits, "-", "_" or "/". Can be empty.`}
            error={errors.prefix?.message}
            {...register('prefix')}
          />
          <Input
            label="Suffix"
            autoComplete="off"
            placeholder="e.g. /26"
            maxLength={PREFIX_MAX_LENGTH}
            hint={`After the number, for example the year: INV-00042/26. Can be empty.`}
            error={errors.suffix?.message}
            {...register('suffix')}
          />
          <Input
            label="Zero padding"
            required
            inputMode="numeric"
            autoComplete="off"
            hint={`Digits in the number, filled with leading zeros: 5 shows 42 as 00042. ${PADDING_MIN} to ${PADDING_MAX}.`}
            error={errors.padding?.message}
            {...register('padding')}
          />
          <Input
            label="Next number"
            required
            inputMode="numeric"
            autoComplete="off"
            hint={
              forwardOnly
                ? `Now ${sequence.next_number}. It can be raised, never lowered.`
                : `Now ${sequence.next_number}.`
            }
            error={errors.next_number?.message}
            {...register('next_number')}
          />
        </fieldset>
      </Card>

      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-text">How numbering works</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-muted">
          <li>
            Numbers only move forward. You can raise the next number, for example to carry on from
            another system, but never lower it, so no {info.noun} number is issued twice.
          </li>
          <li>
            A number that already exists cannot be used again: a next number that matches an
            existing {info.noun} is refused.
          </li>
          <li>
            A new prefix, suffix or padding applies to the numbers issued from now on; every{' '}
            {info.noun} that already has a number keeps it.
          </li>
        </ul>
      </Card>

      {submitError ? (
        <FormAlert message={submitError.message} requestId={submitError.requestId} />
      ) : null}

      {editable ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-2 rounded-xl border border-border bg-surface/95 p-3 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-end">
          {isDirty ? (
            <span className="mr-auto hidden text-sm text-text-muted sm:inline">
              You have unsaved changes.
            </span>
          ) : null}
          <Button
            disabled={!isDirty || update.isPending}
            onClick={() => {
              clearSubmitError();
              reset(toValues(sequence), RESET_ALL);
            }}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={update.isPending}
            disabled={!isDirty || retryIn > 0}
          >
            Save changes
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Badge tone="grey">Read only</Badge>
          Changing the numbering needs permission to update the practice settings.
        </p>
      )}
    </form>
  );
}

export interface NumberingFormProps {
  kind: NumberedDocument;
}

/**
 * The numbering of one kind of document: prefix, zero padding and next number, with a live
 * preview of the next number. Reads `GET /sequences` (any member) and saves with
 * `PATCH /sequences/{kind}` (`organization.update`). A kind the API does not list yet (estimates)
 * shows an explanation and is never requested.
 */
export function NumberingForm({ kind }: NumberingFormProps) {
  const info = NUMBERED_DOCUMENTS[kind];
  const sequences = useSequences();

  if (sequences.isPending) return <NumberingSkeleton label={`Loading ${info.noun} numbering`} />;
  if (sequences.isError && !sequences.data) {
    return (
      <LoadError
        title={`Could not load the ${info.noun} numbering`}
        error={sequences.error}
        onRetry={() => void sequences.refetch()}
        retrying={sequences.isRefetching}
      />
    );
  }
  const sequence = sequences.data?.find((item) => item.kind === kind);
  if (!sequence) return <NotAvailable kind={kind} info={info} />;
  return <NumberingEditor kind={kind} sequence={sequence} />;
}
