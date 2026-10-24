import { Trash2 } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';

import { useOrgPreferenceStore } from '@/app/store';
import { FormAlert } from '@/components/forms';
import { Button, Input, Modal, useToast } from '@/components/ui';
import { routes } from '@/constants/routes';
import { isApiError } from '@/services/api';
import type { Organization } from '@/types/organization';

import { useDeleteOrganization } from '../api/hooks';

export interface DeleteOrganizationProps {
  organization: Organization;
}

/** Danger-zone action: deletes the practice after its name has been typed. */
export function DeleteOrganization({ organization }: DeleteOrganizationProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const formId = useId();
  const remove = useDeleteOrganization(organization);
  const setLastOrgSlug = useOrgPreferenceStore((state) => state.setLastOrgSlug);
  const navigate = useNavigate();
  const { toast } = useToast();
  const matches = typed.trim() === organization.name.trim();

  const close = () => {
    if (remove.isPending) return;
    setOpen(false);
    setTyped('');
    setError(null);
  };

  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!matches || remove.isPending) return;
    setError(null);
    // The API compares with the stored name, so send that rather than the typed copy.
    remove.mutate(organization.name, {
      onSuccess: () => {
        setLastOrgSlug(null);
        toast({ tone: 'success', title: `${organization.name} was deleted` });
        void navigate(routes.app, { replace: true });
      },
      onError: (cause) => {
        const message = isApiError(cause) ? cause.message : 'Please try again.';
        setError({ message, requestId: isApiError(cause) ? cause.requestId : undefined });
        toast({ tone: 'error', title: 'Could not delete the practice', description: message });
      },
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-text">Delete practice</h3>
          <p className="text-sm text-text-muted">
            Removes the practice with its clients, jobs, time and billing for everyone.
          </p>
        </div>
        <Button
          variant="danger"
          leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto"
        >
          Delete practice
        </Button>
      </div>
      <Modal
        open={open}
        onClose={close}
        closeOnBackdrop={false}
        title="Delete this practice?"
        description={`Everyone loses access to ${organization.name} immediately. This cannot be undone from the app.`}
        footer={
          <>
            <Button onClick={close} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="danger"
              loading={remove.isPending}
              disabled={!matches}
            >
              Delete practice
            </Button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4 pt-1">
          <Input
            label={
              <>
                Type <strong className="font-semibold break-all">{organization.name}</strong> to
                confirm
              </>
            }
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          {error ? <FormAlert message={error.message} requestId={error.requestId} /> : null}
        </form>
      </Modal>
    </>
  );
}
