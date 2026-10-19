import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { todayInZone } from '@/utils/dates';

import { useDeactivateStaff } from '../../api';
import { deactivateSchema, type DeactivateValues } from '../../schemas/staff';
import type { StaffMember } from '../../types';
import { RadioGroupField, type RadioOption } from '../RadioGroupField';
import { DialogActions } from '../DialogActions';

const FIELDS = ['status', 'leaving_date'] as const;

export interface DeactivateStaffDialogProps {
  staff: StaffMember | null;
  onClose: () => void;
}

function DeactivateForm({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const { organization } = useOrg();
  const deactivate = useDeactivateStaff();
  const { toast } = useToast();
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<DeactivateValues>({
    resolver: zodResolver(deactivateSchema),
    defaultValues: {
      status: staff.status === 'inactive' ? 'left' : 'inactive',
      leaving_date: staff.leaving_date ?? todayInZone(organization.timezone),
    },
  });
  const status = useWatch({ control, name: 'status' });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<DeactivateValues>({ setError, fields: FIELDS });

  const options: RadioOption<DeactivateValues['status']>[] = [
    ...(staff.status === 'inactive'
      ? []
      : [
          {
            value: 'inactive' as const,
            label: 'Deactivate',
            description: 'Paused: no new time can be recorded for them. They can come back.',
          },
        ]),
    {
      value: 'left',
      label: 'Mark as left',
      description: 'They no longer work for the practice. Their leaving date is recorded.',
    },
  ];

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    deactivate.mutate(
      {
        staffId: staff.id,
        status: values.status,
        leavingDate: values.leaving_date || undefined,
      },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title:
              values.status === 'left'
                ? `${staff.full_name} marked as left`
                : `${staff.full_name} deactivated`,
          });
          onClose();
        },
        onError: handleSubmitError,
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
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <RadioGroupField
              legend="What happens to them"
              value={field.value}
              onChange={field.onChange}
              options={options}
            />
          )}
        />
        {status === 'left' ? (
          <Input
            label="Leaving date"
            type="date"
            hint="The last day they worked for the practice."
            error={errors.leaving_date?.message}
            {...register('leaving_date')}
          />
        ) : null}
        <p className="text-sm text-text-muted">
          Their time, expenses, invoices and rates stay on record.
          {staff.has_login
            ? ' They are signed out everywhere and cannot sign in until you reactivate them.'
            : ''}
          {status === 'left' ? ' Everyone they approve loses their approver.' : ''}
        </p>
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form={formId}
          variant="danger"
          loading={deactivate.isPending}
          disabled={retryIn > 0}
        >
          {status === 'left' ? 'Mark as left' : 'Deactivate'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Pause a staff member, or record that they left. */
export function DeactivateStaffDialog({ staff, onClose }: DeactivateStaffDialogProps) {
  return (
    <Modal
      open={staff !== null}
      onClose={onClose}
      title="Deactivate staff member?"
      description={staff ? `${staff.full_name} · ${staff.code}` : undefined}
      size="md"
    >
      {staff ? <DeactivateForm key={staff.id} staff={staff} onClose={onClose} /> : null}
    </Modal>
  );
}
