import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, ConfirmDialog, Modal, Textarea, useToast } from '@/components/ui';
import { formatMoney } from '@/utils/money';

import { useApproveClaim, useBulkApprove, useReturnClaim } from '../api';
import { LIMITS } from '../constants';
import {
  approveSchema,
  returnSchema,
  type ApproveValues,
  type ReturnValues,
} from '../schemas/forms';
import type { ExpenseClaim } from '../types';
import { dialogError, toFormError } from '../utils/errors';
import { claimLabel, pluralize } from '../utils/format';
import { DialogActions } from './DialogActions';

export interface ClaimDialogProps {
  claim: Pick<ExpenseClaim, 'id' | 'title' | 'user_name' | 'first_date' | 'line_count' | 'totals'>;
  open: boolean;
  onClose: () => void;
  /** Called once the API has answered, before the dialog closes. */
  onDone?: () => void;
}

function ReturnForm({ claim, onClose, onDone }: Omit<ClaimDialogProps, 'open'>) {
  const send = useReturnClaim();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReturnValues>({ resolver: zodResolver(returnSchema), defaultValues: { reason: '' } });
  const { submitError, handleSubmitError, clearSubmitError } = useSubmitError<ReturnValues>({
    setError,
    fields: ['reason'],
  });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    send.mutate(
      { claimId: claim.id, reason: values.reason },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: 'Claim returned',
            description: `${claim.user_name ?? 'The claimant'} can edit it and submit it again.`,
          });
          onDone?.();
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
        <Textarea
          label="Reason"
          rows={4}
          maxLength={LIMITS.decision}
          hint="The claimant reads this: say what to change."
          error={errors.reason?.message}
          {...register('reason')}
        />
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="danger" loading={send.isPending}>
          Return claim
        </Button>
      </DialogActions>
    </>
  );
}

/** Sends a submitted claim back with a reason (required): the claimant edits and resubmits it. */
export function ReturnDialog({ claim, open, onClose, onDone }: ClaimDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Return this claim?"
      description={`${claimLabel(claim)} · ${formatMoney(claim.totals.gross)}`}
      closeOnBackdrop={false}
    >
      {open ? <ReturnForm key={claim.id} claim={claim} onClose={onClose} onDone={onDone} /> : null}
    </Modal>
  );
}

function ApproveForm({ claim, onClose, onDone }: Omit<ClaimDialogProps, 'open'>) {
  const send = useApproveClaim();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ApproveValues>({ resolver: zodResolver(approveSchema), defaultValues: { note: '' } });
  const { submitError, handleSubmitError, clearSubmitError } = useSubmitError<ApproveValues>({
    setError,
    fields: ['note'],
  });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    send.mutate(
      { claimId: claim.id, note: values.note || undefined },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Claim approved' });
          onDone?.();
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
        <p className="text-sm text-text-muted">
          Its billable lines become work in progress for their clients and the claim can no longer
          be changed by {claim.user_name ?? 'the claimant'}.
        </p>
        <Textarea
          label="Note (optional)"
          rows={3}
          maxLength={LIMITS.decision}
          hint="Shown to the claimant with the decision."
          error={errors.note?.message}
          {...register('note')}
        />
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form={formId} variant="primary" loading={send.isPending}>
          Approve claim
        </Button>
      </DialogActions>
    </>
  );
}

/** Approves a submitted claim, with an optional note. */
export function ApproveDialog({ claim, open, onClose, onDone }: ClaimDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approve this claim?"
      description={`${claimLabel(claim)} · ${formatMoney(claim.totals.gross)}`}
      closeOnBackdrop={false}
    >
      {open ? <ApproveForm key={claim.id} claim={claim} onClose={onClose} onDone={onDone} /> : null}
    </Modal>
  );
}

export interface BulkApproveDialogProps {
  claims: ReadonlyArray<Pick<ExpenseClaim, 'id' | 'totals'>>;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

/** Approves several claims at once: all of them or none (the API is atomic). */
export function BulkApproveDialog({ claims, open, onClose, onDone }: BulkApproveDialogProps) {
  const approve = useBulkApprove();
  const { toast } = useToast();
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const total = claims.reduce((sum, claim) => sum + claim.totals.gross, 0);

  const close = () => {
    setRefusal(null);
    onClose();
  };

  const confirm = () => {
    setRefusal(null);
    approve.mutate(
      claims.map((claim) => claim.id),
      {
        onSuccess: (result) => {
          toast({ tone: 'success', title: result.message ?? 'Claims approved' });
          onDone();
        },
        onError: (error) => setRefusal(dialogError(error)),
      },
    );
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={close}
      onConfirm={confirm}
      title={`Approve ${pluralize(claims.length, 'claim')}?`}
      tone="default"
      confirmLabel={`Approve ${pluralize(claims.length, 'claim')}`}
      loading={approve.isPending}
      error={refusal}
    >
      <p>
        Together they come to {formatMoney(total)}. Their billable lines become work in progress. If
        one of them cannot be approved, none is.
      </p>
    </ConfirmDialog>
  );
}
