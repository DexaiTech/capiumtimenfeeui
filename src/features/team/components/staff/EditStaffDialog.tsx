import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Button, ErrorState, Modal, Skeleton, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';
import { minutesToHours, parseMinutes } from '@/utils/minutes';

import { useGradeOptions, useSaveStaff } from '../../api';
import { staffEditSchema, type StaffFormValues } from '../../schemas/staff';
import type { Grade, StaffMember, StaffUpdate } from '../../types';
import { toFormError } from '../../utils/errors';
import { bpToPercent, percentToBp } from '../../utils/format';
import { StaffFormFields } from './StaffFormFields';
import { DialogActions } from '../DialogActions';

const FIELDS = [
  'full_name',
  'code',
  'email',
  'grade_id',
  'approver_id',
  'job_title',
  'initials',
  'hours_per_day',
  'working_days',
  'target_percent',
  'start_date',
  'leaving_date',
  'status',
] as const;
/** API field → form field. */
const FIELD_NAMES = {
  working_minutes_per_day: 'hours_per_day',
  chargeable_target_bp: 'target_percent',
};

const sameDays = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
  a.length === b.length && a.every((day, index) => day === b[index]);

export interface EditStaffDialogProps {
  staff: StaffMember | null;
  onClose: () => void;
}

function EditStaffForm({
  staff,
  grades,
  onClose,
}: {
  staff: StaffMember;
  grades: ReadonlyArray<Grade>;
  onClose: () => void;
}) {
  const save = useSaveStaff();
  const { toast } = useToast();
  const formId = useId();
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffEditSchema),
    defaultValues: {
      full_name: staff.full_name,
      code: staff.code,
      email: staff.email ?? '',
      grade_id: staff.grade?.id ?? '',
      approver_id: staff.approver?.id ?? null,
      job_title: staff.job_title ?? '',
      initials: staff.initials ?? '',
      hours_per_day: minutesToHours(staff.working_minutes_per_day),
      working_days: staff.working_days,
      target_percent: bpToPercent(staff.chargeable_target_bp),
      start_date: staff.start_date ?? '',
      leaving_date: staff.leaving_date ?? '',
      status: staff.status,
      login: 'none',
      login_email: '',
      role_id: '',
      send_email: false,
    },
  });
  const {
    handleSubmit,
    setError,
    formState: { isDirty },
  } = form;
  const { submitError, retryIn, handleSubmitError, clearSubmitError } =
    useSubmitError<StaffFormValues>({ setError, fields: FIELDS });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    // PATCH is partial: send only what changed.
    const changes: StaffUpdate = {};
    if (values.full_name !== staff.full_name) changes.full_name = values.full_name;
    const code = values.code.toUpperCase();
    if (code !== staff.code) changes.code = code;
    const email = values.email || null;
    if (email !== staff.email) changes.email = email;
    if (values.grade_id !== staff.grade?.id) changes.grade_id = values.grade_id;
    if (values.approver_id !== (staff.approver?.id ?? null))
      changes.approver_id = values.approver_id;
    const jobTitle = values.job_title || null;
    if (jobTitle !== staff.job_title) changes.job_title = jobTitle;
    const initials = values.initials ? values.initials.toUpperCase() : null;
    if (initials !== staff.initials) changes.initials = initials;
    const minutes = parseMinutes(values.hours_per_day);
    if (minutes !== null && minutes !== staff.working_minutes_per_day) {
      changes.working_minutes_per_day = minutes;
    }
    if (!sameDays(values.working_days, staff.working_days)) {
      changes.working_days = values.working_days;
    }
    const target = percentToBp(values.target_percent);
    if (target !== null && target !== staff.chargeable_target_bp) {
      changes.chargeable_target_bp = target;
    }
    const startDate = values.start_date || null;
    if (startDate !== staff.start_date) changes.start_date = startDate;
    const leavingDate = values.leaving_date || null;
    if (leavingDate !== staff.leaving_date) changes.leaving_date = leavingDate;

    const status = values.status === staff.status ? undefined : values.status;
    if (Object.keys(changes).length === 0 && status === undefined) {
      onClose();
      return;
    }
    save.mutate(
      { staff, changes, status, leavingDate: values.leaving_date || undefined },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `Details of ${values.full_name} saved` });
          onClose();
        },
        onError: (error) => handleSubmitError(toFormError(error, FIELD_NAMES)),
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
        <StaffFormFields
          mode="edit"
          form={form}
          grades={grades}
          currentGrade={staff.grade}
          staffId={staff.id}
          approverName={staff.approver?.full_name}
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
          loading={save.isPending}
          disabled={!isDirty || retryIn > 0}
        >
          Save details
        </Button>
      </DialogActions>
    </>
  );
}

/** Edit every profile field of a staff member, including their status. */
export function EditStaffDialog({ staff, onClose }: EditStaffDialogProps) {
  const grades = useGradeOptions({ enabled: staff !== null });
  return (
    <Modal
      open={staff !== null}
      onClose={onClose}
      title="Edit staff member"
      description={staff ? `${staff.full_name} · ${staff.code}` : undefined}
      size="lg"
      closeOnBackdrop={false}
    >
      {staff === null ? null : grades.isPending ? (
        <div role="status" aria-label="Loading" className="flex flex-col gap-4">
          <Skeleton shape="rect" className="h-10 w-full" />
          <Skeleton shape="rect" className="h-10 w-full" />
          <Skeleton shape="rect" className="h-10 w-full" />
        </div>
      ) : grades.isError ? (
        <ErrorState
          title="Could not load the grades"
          error={isApiError(grades.error) ? grades.error : null}
          onRetry={() => void grades.refetch()}
          retrying={grades.isRefetching}
          className="py-6"
        />
      ) : (
        <EditStaffForm key={staff.id} staff={staff} grades={grades.data} onClose={onClose} />
      )}
    </Modal>
  );
}
