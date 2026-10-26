import { Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { FormAlert } from '@/components/forms';
import { Badge, Button, Card, CardHeader, Sheet, Skeleton, useToast } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { PermissionPicker, usePermissionCatalogue, type Permission } from '@/features/settings';
import { isApiError } from '@/services/api';

import { useMemberPermissions, useSetMemberPermissions } from '../../api';
import type { MemberPermissions, StaffDetail } from '../../types';
import { overridesFor } from '../../utils/permissions';

const OWNER_KEY = 'owner';

function describe(catalogue: ReadonlyArray<Permission>, codes: ReadonlyArray<string>) {
  const names = new Map(catalogue.map((permission) => [permission.code, permission.description]));
  return codes.map((code) => ({ code, label: names.get(code) ?? code }));
}

function PermissionsEditor({
  staff,
  current,
  catalogue,
  onClose,
}: {
  staff: StaffDetail;
  current: MemberPermissions;
  catalogue: ReadonlyArray<Permission>;
  onClose: () => void;
}) {
  const { can } = useOrg();
  const { toast } = useToast();
  const save = useSetMemberPermissions(staff.id);
  const [wanted, setWanted] = useState<string[]>(current.effective);
  const [failure, setFailure] = useState<string | null>(null);

  const { grants, denies } = overridesFor(current.role_permissions, wanted);
  const unchanged =
    grants.join() === current.grants.join() && denies.join() === current.denies.join();

  const submit = () => {
    setFailure(null);
    save.mutate(
      { grants, denies },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `${staff.full_name}'s permissions saved` });
          onClose();
        },
        onError: (error) =>
          setFailure(isApiError(error) ? error.message : 'Could not save the permissions.'),
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-1 border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-text">Permissions of {staff.full_name}</h2>
        <p className="text-xs text-text-muted">
          Starts from the {current.role.name} role. Tick what this person can do: what you add is
          given to them alone, and what you untick is taken from them alone. Other people with the
          same role are not affected.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PermissionPicker catalogue={catalogue} value={wanted} onChange={setWanted} held={can} />
      </div>
      <footer className="flex flex-col gap-3 border-t border-border px-5 py-3">
        {failure ? <FormAlert message={failure} /> : null}
        <p className="text-xs text-text-muted" aria-live="polite">
          {grants.length === 0 && denies.length === 0
            ? 'The same as the role.'
            : `${grants.length} more than the role, ${denies.length} fewer.`}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => setWanted(current.role_permissions)}>Reset to the role</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={unchanged} onClick={submit}>
            Save permissions
          </Button>
        </div>
      </footer>
    </div>
  );
}

/**
 * What one person can do: their role's permissions, with the extras given to them and what was
 * taken away. Anyone who may manage roles can change it for this person alone.
 */
export function StaffPermissionsCard({ staff }: { staff: StaffDetail }) {
  const { can } = useOrg();
  const permissions = useMemberPermissions(staff.id, true);
  const catalogue = usePermissionCatalogue();
  const [editing, setEditing] = useState(false);

  const isOwner = staff.role.system_key === OWNER_KEY;
  const canEdit = can(PERMISSIONS.roleManage) && !isOwner;
  const data = permissions.data;

  return (
    <Card padding="none" role="region" aria-label="Permissions">
      <CardHeader
        title="Permissions"
        description="The role sets what a person can do; here one person can be given more, or less, than their role."
        actions={
          canEdit ? (
            <Button
              size="sm"
              leftIcon={<ShieldCheck aria-hidden="true" className="size-4" />}
              disabled={!data || !catalogue.data}
              onClick={() => setEditing(true)}
            >
              Edit permissions
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-3 p-5">
        {permissions.isPending ? (
          <Skeleton shape="rect" className="h-12 w-full" />
        ) : permissions.isError || !data ? (
          <p className="text-sm text-danger">Could not load this person&apos;s permissions.</p>
        ) : (
          <>
            <p className="text-sm text-text">
              <Badge tone="neutral">{data.role.name}</Badge>{' '}
              <span className="text-text-muted">
                role · {data.effective.length} permissions
                {isOwner ? ' (an Owner always holds every permission)' : ''}
              </span>
            </p>
            {data.grants.length === 0 && data.denies.length === 0 ? (
              <p className="text-sm text-text-muted">
                No changes: this person has exactly what their role gives.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.grants.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-muted">Also allowed</span>
                    <ul aria-label="Also allowed" className="flex flex-wrap gap-2">
                      {describe(catalogue.data ?? [], data.grants).map((item) => (
                        <li key={item.code}>
                          <Badge tone="success">{item.label}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {data.denies.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-xs font-medium text-text-muted">
                      <Lock aria-hidden="true" className="size-3" />
                      Not allowed
                    </span>
                    <ul aria-label="Not allowed" className="flex flex-wrap gap-2">
                      {describe(catalogue.data ?? [], data.denies).map((item) => (
                        <li key={item.code}>
                          <Badge tone="danger">{item.label}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        label={`Permissions of ${staff.full_name}`}
        className="ml-auto max-w-3xl"
      >
        {editing && data && catalogue.data ? (
          <PermissionsEditor
            staff={staff}
            current={data}
            catalogue={catalogue.data}
            onClose={() => setEditing(false)}
          />
        ) : null}
      </Sheet>
    </Card>
  );
}
