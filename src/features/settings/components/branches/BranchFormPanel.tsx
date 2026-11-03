import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, FormPanel, Input, useToast } from '@/components/ui';

import { useCreateBranch, useUpdateBranch } from '../../api/branchHooks';
import type { Branch } from '../../branchTypes';
import { branchSchema, type BranchValues } from '../../schemas/branch';
import { toBillingFormError } from '../../utils/billingErrors';
import { DialogActions } from '../DialogActions';

const FIELDS = ['name'] as const;

export interface BranchFormPanelProps {
  /** The branch to change, null to add one. */
  branch: Branch | null;
  open: boolean;
  onClose: () => void;
}

function BranchForm({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: branch?.name ?? '' },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<BranchValues>({ setError, fields: FIELDS });
  const saving = create.isPending || update.isPending;

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const onError = (error: unknown) => handleSubmitError(toBillingFormError(error));

    if (!branch) {
      create.mutate(
        { name: values.name },
        {
          onSuccess: (created) => {
            toast({ tone: 'success', title: `${created.name} added` });
            onClose();
          },
          onError,
        },
      );
      return;
    }

    if (values.name === branch.name) {
      onClose();
      return;
    }
    update.mutate(
      { branchId: branch.id, body: { name: values.name } },
      {
        onSuccess: (saved) => {
          toast({ tone: 'success', title: `${saved.name} saved` });
          onClose();
        },
        onError,
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
          label="Name"
          required
          autoComplete="off"
          maxLength={40}
          hint="Shown wherever a client's branch is chosen, for example London or Manchester."
          error={errors.name?.message}
          {...register('name')}
        />
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          loading={saving}
          disabled={(branch !== null && !isDirty) || retryIn > 0}
        >
          {branch ? 'Save branch' : 'Add branch'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add a branch, or rename one. */
export function BranchFormPanel({ branch, open, onClose }: BranchFormPanelProps) {
  return (
    <FormPanel
      open={open}
      onClose={onClose}
      title={branch ? 'Edit branch' : 'Add branch'}
      description={branch ? branch.name : 'An office of the practice, for example London.'}
    >
      {open ? <BranchForm key={branch?.id ?? 'new'} branch={branch} onClose={onClose} /> : null}
    </FormPanel>
  );
}
