import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate, todayInZone } from '@/utils/dates';

import { useUpdateRateRule } from '../../api';
import { RATE_KIND_LABEL } from '../../constants';
import { endDateSchema, type EndDateValues } from '../../schemas/rate';
import type { RateRule } from '../../types';
import { toFormError } from '../../utils/errors';
import { formatRate, scopeNames } from '../../utils/format';
import { DialogActions } from '../DialogActions';

const FIELDS = ['effective_to'] as const;

function EndDateForm({ rule, onClose }: { rule: RateRule; onClose: () => void }) {
  const { organization } = useOrg();
  const update = useUpdateRateRule();
  const { toast } = useToast();
  const formId = useId();
  const today = todayInZone(organization.timezone);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EndDateValues>({
    resolver: zodResolver(endDateSchema),
    defaultValues: {
      // Today when the rate has already started, else the day it starts.
      effective_to:
        rule.effective_to ?? (today >= rule.effective_from ? today : rule.effective_from),
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<EndDateValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    if (values.effective_to < rule.effective_from) {
      setError('effective_to', {
        message: `The rate starts on ${formatUkDate(rule.effective_from)}; it can't end before that`,
      });
      return;
    }
    update.mutate(
      { ruleId: rule.id, body: { effective_to: values.effective_to } },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: `Rate ends on ${formatUkDate(values.effective_to)}`,
          });
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
          <strong className="font-medium text-text">{scopeNames(rule).join(' · ')}</strong> at{' '}
          {formatRate(rule.rate)}, from {formatUkDate(rule.effective_from)}. The rate applies up to
          and including the last day you choose. Time already recorded keeps the rate it was given.
        </p>
        <Input
          label="Last day of the rate"
          required
          type="date"
          min={rule.effective_from}
          error={errors.effective_to?.message}
          {...register('effective_to')}
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
          loading={update.isPending}
          disabled={retryIn > 0}
        >
          End-date rate
        </Button>
      </DialogActions>
    </>
  );
}

export interface EndDateDialogProps {
  /** The rate to end; null while the dialog is closed. */
  rule: RateRule | null;
  onClose: () => void;
}

/**
 * Sets the last day a rate applies. This is how a rate that has been used is retired: it is
 * never deleted, and the entries already recorded under it keep their rates.
 */
export function EndDateDialog({ rule, onClose }: EndDateDialogProps) {
  return (
    <Modal
      open={rule !== null}
      onClose={onClose}
      title="End-date rate"
      description={rule ? `${RATE_KIND_LABEL[rule.kind]} rate · ${rule.level_label}` : undefined}
      size="md"
      closeOnBackdrop={false}
    >
      {rule ? <EndDateForm key={rule.id} rule={rule} onClose={onClose} /> : null}
    </Modal>
  );
}
