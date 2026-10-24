import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, FormPanel, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { StaffPicker } from '@/features/team';

import { useCreateClaim, useUpdateClaimTitle } from '../api';
import { LIMITS } from '../constants';
import {
  claimTitleSchema,
  newClaimSchema,
  type ClaimTitleValues,
  type NewClaimValues,
} from '../schemas/forms';
import type { ExpenseClaimDetail } from '../types';
import { toFormError } from '../utils/errors';
import { DialogActions } from './DialogActions';

export interface NewClaimPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new draft claim: the page opens it. */
  onCreated: (claim: ExpenseClaimDetail) => void;
}

function NewClaimForm({ onClose, onCreated }: Omit<NewClaimPanelProps, 'open'>) {
  const { can } = useOrg();
  const { toast } = useToast();
  const create = useCreateClaim();
  const formId = useId();
  const [claimant, setClaimant] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NewClaimValues>({
    resolver: zodResolver(newClaimSchema),
    defaultValues: { title: '', user_id: '' },
  });
  const { submitError, handleSubmitError, clearSubmitError } = useSubmitError<NewClaimValues>({
    setError,
    fields: ['title', 'user_id'],
  });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    create.mutate(
      {
        ...(values.title ? { title: values.title } : {}),
        ...(claimant ? { user_id: claimant } : {}),
      },
      {
        onSuccess: (claim) => {
          toast({
            tone: 'success',
            title: 'Claim started',
            description: 'Add the expenses to it now.',
          });
          onCreated(claim);
        },
        onError: (error) => handleSubmitError(toFormError(error)),
      },
    );
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Title (optional)"
          autoComplete="off"
          maxLength={LIMITS.title}
          hint="For example the trip or the month: it helps whoever approves the claim."
          error={errors.title?.message}
          {...register('title')}
        />
        {can('expense.manage') ? (
          <StaffPicker
            label="Claim for"
            clearable
            selectable
            value={claimant}
            onChange={(id) => setClaimant(id)}
            hint="Leave empty for your own claim. Staff without a login can be chosen too."
          />
        ) : null}
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
          Start claim
        </Button>
      </DialogActions>
    </>
  );
}

/** Starts a draft claim: a title if wanted, and (with `expense.manage`) whose claim it is. */
export function NewClaimPanel({ open, onClose, onCreated }: NewClaimPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title="New expense claim"
      description="A claim holds the expenses you send for approval together."
    >
      {open ? <NewClaimForm onClose={onClose} onCreated={onCreated} /> : null}
    </FormPanel>
  );
}

export interface ClaimTitlePanelProps {
  claimId: string;
  title: string | null;
  open: boolean;
  onClose: () => void;
}

function ClaimTitleForm({ claimId, title, onClose }: Omit<ClaimTitlePanelProps, 'open'>) {
  const { toast } = useToast();
  const update = useUpdateClaimTitle();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ClaimTitleValues>({
    resolver: zodResolver(claimTitleSchema),
    defaultValues: { title: title ?? '' },
  });
  const { submitError, handleSubmitError, clearSubmitError } = useSubmitError<ClaimTitleValues>({
    setError,
    fields: ['title'],
  });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    update.mutate(
      { claimId, title: values.title || null },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Title saved' });
          onClose();
        },
        onError: (error) => handleSubmitError(toFormError(error)),
      },
    );
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Title"
          autoComplete="off"
          maxLength={LIMITS.title}
          hint="Leave empty to show the dates instead."
          error={errors.title?.message}
          {...register('title')}
        />
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={update.isPending}>
          Save title
        </Button>
      </DialogActions>
    </>
  );
}

/** Changes the title of a draft or returned claim. */
export function ClaimTitlePanel({ claimId, title, open, onClose }: ClaimTitlePanelProps) {
  return (
    <FormPanel open={open} onClose={onClose} title="Edit title">
      {open ? <ClaimTitleForm claimId={claimId} title={title} onClose={onClose} /> : null}
    </FormPanel>
  );
}
