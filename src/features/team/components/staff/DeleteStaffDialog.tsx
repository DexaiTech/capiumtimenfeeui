import { useState, type ReactNode } from 'react';

import { Button, ConfirmDialog, ErrorState, Skeleton, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useDeleteStaff, useStaffMember } from '../../api';
import type { StaffMember, StaffUsage } from '../../types';
import { dialogError, usageOf } from '../../utils/errors';

export interface DeleteStaffDialogProps {
  staff: StaffMember | null;
  onClose: () => void;
  /** Offered when the record is in use: the way to take them out of the working lists. */
  onDeactivateInstead?: (staff: StaffMember) => void;
  /** Called once the person has been deleted (before the dialog closes). */
  onDeleted?: (staff: StaffMember) => void;
}

function UsageList({ usage }: { usage: ReadonlyArray<StaffUsage> }) {
  return (
    <ul aria-label="Records that refer to them" className="flex flex-col gap-1 text-sm text-text">
      {usage.map((item) => (
        <li key={item.kind} className="flex items-center justify-between gap-3">
          <span>{item.label}</span>
          <span className="font-medium tabular-nums">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function DeleteConfirm({
  staff,
  onClose,
  onDeactivateInstead,
  onDeleted,
}: DeleteStaffDialogProps) {
  const detail = useStaffMember(staff?.id ?? null);
  const remove = useDeleteStaff();
  const { toast } = useToast();
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const [usageFromError, setUsageFromError] = useState<StaffUsage[]>([]);

  const usage = usageFromError.length > 0 ? usageFromError : (detail.data?.usage ?? []);
  const inUse = usage.length > 0 || detail.data?.can_delete === false;
  const name = staff?.full_name ?? '';

  const confirm = () => {
    if (!staff) return;
    setRefusal(null);
    remove.mutate(staff.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${staff.full_name} deleted` });
        onDeleted?.(staff);
        onClose();
      },
      onError: (error) => {
        setUsageFromError(usageOf(error));
        setRefusal(dialogError(error));
      },
    });
  };

  let body: ReactNode;
  if (detail.isPending) {
    body = (
      <div role="status" aria-label="Checking what refers to them" className="flex flex-col gap-3">
        <Skeleton shape="rect" className="h-4 w-3/4" />
        <Skeleton shape="rect" className="h-4 w-1/2" />
      </div>
    );
  } else if (detail.isError) {
    body = (
      <ErrorState
        title="Could not check the record"
        error={isApiError(detail.error) ? detail.error : null}
        onRetry={() => void detail.refetch()}
        retrying={detail.isRefetching}
        className="py-6"
      />
    );
  } else if (inUse) {
    body = (
      <>
        <p>
          <strong className="font-medium text-text">{name}</strong> cannot be deleted: these records
          refer to them. Deactivate them instead; everything recorded stays.
        </p>
        <UsageList usage={usage} />
        {onDeactivateInstead && staff ? (
          <div>
            <Button size="sm" onClick={() => onDeactivateInstead(staff)}>
              Deactivate instead
            </Button>
          </div>
        ) : null}
      </>
    );
  } else {
    body = (
      <p>
        <strong className="font-medium text-text">{name}</strong> is not used by any record, so
        deleting removes them completely. This cannot be undone.
      </p>
    );
  }

  return (
    <ConfirmDialog
      open={staff !== null}
      onClose={onClose}
      onConfirm={confirm}
      title="Delete staff member?"
      confirmLabel="Delete"
      loading={remove.isPending}
      confirmDisabled={detail.isPending || detail.isError || inUse}
      error={refusal}
    >
      {body}
    </ConfirmDialog>
  );
}

/** Delete a staff member nothing refers to; otherwise explain what does and offer to deactivate. */
export function DeleteStaffDialog(props: DeleteStaffDialogProps) {
  // A fresh state for every person, so a refusal never carries over to the next one.
  return <DeleteConfirm key={props.staff?.id ?? 'none'} {...props} />;
}
