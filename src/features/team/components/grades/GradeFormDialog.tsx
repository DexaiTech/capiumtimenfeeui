import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, Textarea, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { parsePounds, penceToPoundsInput } from '@/utils/money';

import { useCreateGrade, useUpdateGrade } from '../../api';
import { gradeSchema, type GradeValues } from '../../schemas/grade';
import type { Grade, GradeCreate, GradeUpdate } from '../../types';
import { toFormError } from '../../utils/errors';
import { bpToPercent, percentToBp } from '../../utils/format';
import { DialogActions } from '../DialogActions';

const FIELDS = [
  'code',
  'name',
  'description',
  'default_cost_rate',
  'default_charge_rate',
  'target_percent',
  'sort_order',
] as const;
/** API field → form field. */
const FIELD_NAMES = { default_chargeable_target_bp: 'target_percent' };

/** Pounds as typed → pence, or null for an empty field. */
const pence = (text: string) => (text.trim() === '' ? null : parsePounds(text));

export interface GradeFormDialogProps {
  /** The grade to change, null to add one. */
  grade: Grade | null;
  open: boolean;
  onClose: () => void;
}

function GradeForm({ grade, onClose }: { grade: Grade | null; onClose: () => void }) {
  const { can } = useOrg();
  // Without `rate.read` the API hides the cost default, so the field is not offered either:
  // saving must never overwrite a value the person cannot see.
  const canReadRates = can(PERMISSIONS.rateRead);
  const create = useCreateGrade();
  const update = useUpdateGrade();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<GradeValues>({
    resolver: zodResolver(gradeSchema),
    defaultValues: {
      code: grade?.code ?? '',
      name: grade?.name ?? '',
      description: grade?.description ?? '',
      default_cost_rate: penceToPoundsInput(grade?.default_cost_rate),
      default_charge_rate: penceToPoundsInput(grade?.default_charge_rate),
      target_percent:
        grade?.default_chargeable_target_bp == null
          ? ''
          : bpToPercent(grade.default_chargeable_target_bp),
      sort_order: String(grade?.sort_order ?? 0),
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<GradeValues>(
    { setError, fields: FIELDS },
  );
  const saving = create.isPending || update.isPending;

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const code = values.code.toUpperCase();
    const description = values.description || null;
    const charge = pence(values.default_charge_rate);
    const cost = canReadRates ? pence(values.default_cost_rate) : null;
    const target = values.target_percent.trim() === '' ? null : percentToBp(values.target_percent);
    const sortOrder = Number(values.sort_order);
    const onError = (error: unknown) => handleSubmitError(toFormError(error, FIELD_NAMES));

    if (!grade) {
      const body: GradeCreate = { code, name: values.name, sort_order: sortOrder };
      if (description) body.description = description;
      if (cost !== null) body.default_cost_rate = cost;
      if (charge !== null) body.default_charge_rate = charge;
      if (target !== null) body.default_chargeable_target_bp = target;
      create.mutate(body, {
        onSuccess: (created) => {
          toast({ tone: 'success', title: `${created.name} added` });
          onClose();
        },
        onError,
      });
      return;
    }

    // PATCH is partial: send only what changed (null clears a default).
    const changes: GradeUpdate = {};
    if (code !== grade.code) changes.code = code;
    if (values.name !== grade.name) changes.name = values.name;
    if (description !== grade.description) changes.description = description;
    if (canReadRates && cost !== grade.default_cost_rate) changes.default_cost_rate = cost;
    if (charge !== grade.default_charge_rate) changes.default_charge_rate = charge;
    if (target !== grade.default_chargeable_target_bp)
      changes.default_chargeable_target_bp = target;
    if (sortOrder !== grade.sort_order) changes.sort_order = sortOrder;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { gradeId: grade.id, body: changes },
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
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Input
            label="Name"
            required
            autoComplete="off"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Code"
            required
            autoComplete="off"
            maxLength={12}
            error={errors.code?.message}
            {...register('code')}
          />
        </div>
        <Textarea
          label="Description"
          rows={2}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {canReadRates ? (
            <Input
              label="Default cost rate (£ per hour)"
              inputMode="decimal"
              autoComplete="off"
              hint="What staff of this grade cost the practice. Empty for none."
              error={errors.default_cost_rate?.message}
              {...register('default_cost_rate')}
            />
          ) : null}
          <Input
            label="Default charge-out rate (£ per hour)"
            inputMode="decimal"
            autoComplete="off"
            hint="Used when no more specific rate applies. Empty for none."
            error={errors.default_charge_rate?.message}
            {...register('default_charge_rate')}
          />
          <Input
            label="Default chargeable target (%)"
            inputMode="decimal"
            autoComplete="off"
            hint="The starting target of staff given this grade. Empty for none."
            error={errors.target_percent?.message}
            {...register('target_percent')}
          />
          <Input
            label="Sort order"
            inputMode="numeric"
            autoComplete="off"
            hint="Grades are listed from the lowest number."
            error={errors.sort_order?.message}
            {...register('sort_order')}
          />
        </div>
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
          disabled={(grade !== null && !isDirty) || retryIn > 0}
        >
          {grade ? 'Save grade' : 'Add grade'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add a grade, or change one: name, code, default rates and chargeable target. */
export function GradeFormDialog({ grade, open, onClose }: GradeFormDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={grade ? 'Edit grade' : 'Add grade'}
      description={
        grade
          ? `${grade.name} · ${grade.code}`
          : 'A level of staff with default rates. Changing a default never rewrites recorded time.'
      }
      size="lg"
      closeOnBackdrop={false}
    >
      {open ? <GradeForm key={grade?.id ?? 'new'} grade={grade} onClose={onClose} /> : null}
    </Modal>
  );
}
