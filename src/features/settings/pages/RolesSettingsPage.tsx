import { Plus, ShieldCheck } from 'lucide-react';

import {
  Badge,
  Button,
  CountTabs,
  DataTable,
  EmptyState,
  ErrorState,
  PageToolbar,
  Skeleton,
  type DataTableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useRoleName } from '@/features/system';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { isApiError } from '@/services/api';

import { usePermissionCatalogue, useRoles } from '../api/hooks';
import { RoleEditor } from '../components/roles/RoleEditor';
import { NoAccess, SettingsSection } from '../components/SettingsSection';
import type { Role } from '../types';

const NEW = 'new';

function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading role" className="flex flex-col gap-4">
      <Skeleton shape="rect" className="h-8 w-48" />
      <Skeleton shape="rect" className="h-24 w-full" />
      <Skeleton shape="rect" className="h-40 w-full" />
      <Skeleton shape="rect" className="h-40 w-full" />
    </div>
  );
}

function RolesContent() {
  const { can } = useOrg();
  const roleName = useRoleName();
  const { params, setParam } = useUrlParams();
  const roles = useRoles();
  const selectedId = params.get('role');
  const startFromId = params.get('from');
  // The catalogue is only needed once a role is opened.
  const catalogue = usePermissionCatalogue();
  const canManage = can('role.manage');

  const open = (roleId: string | null, from?: string) =>
    setParam({ role: roleId, from: from ?? null }, { push: true });

  if (roles.isError) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-card">
        <ErrorState
          title="Could not load the roles"
          error={isApiError(roles.error) ? roles.error : null}
          onRetry={() => void roles.refetch()}
          retrying={roles.isRefetching}
        />
      </div>
    );
  }

  if (selectedId) {
    if (roles.isPending || catalogue.isPending) return <EditorSkeleton />;
    if (catalogue.isError) {
      return (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <ErrorState
            title="Could not load the permissions"
            error={isApiError(catalogue.error) ? catalogue.error : null}
            onRetry={() => void catalogue.refetch()}
            retrying={catalogue.isRefetching}
          />
        </div>
      );
    }
    const role = selectedId === NEW ? null : roles.data.find((item) => item.id === selectedId);
    if (role === undefined || (selectedId === NEW && !canManage)) {
      return (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState
            icon={<ShieldCheck className="size-6" />}
            title={selectedId === NEW ? "You can't create roles" : 'Role not found'}
            description={
              selectedId === NEW
                ? 'Your role lets you view roles but not change them.'
                : 'It may have been deleted.'
            }
            action={<Button onClick={() => open(null)}>All roles</Button>}
          />
        </div>
      );
    }
    return (
      <RoleEditor
        // A fresh form per role, and per "start from" source.
        key={`${selectedId}:${startFromId ?? ''}`}
        role={role}
        roles={roles.data}
        catalogue={catalogue.data}
        startFromId={startFromId}
        onBack={() => open(null)}
        onCreated={(created) => setParam({ role: created.id, from: null })}
        onDuplicate={(source) => open(NEW, source.id)}
      />
    );
  }

  const rows = roles.data ?? [];
  const columns: DataTableColumn<Role>[] = [
    {
      id: 'name',
      header: 'Role',
      hideable: false,
      cell: (role) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text"
          >
            <ShieldCheck className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-text">{roleName(role)}</span>
            {role.description ? (
              <span className="text-xs text-text-muted">{role.description}</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      className: 'w-28',
      cell: (role) =>
        role.is_system ? <Badge tone="blue">System</Badge> : <Badge tone="violet">Custom</Badge>,
    },
    {
      id: 'members',
      header: 'Staff',
      align: 'end',
      className: 'w-24 whitespace-nowrap',
      cell: (role) => <span className="text-text-muted tabular-nums">{role.member_count}</span>,
    },
    {
      id: 'permissions',
      header: 'Permissions',
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (role) => (
        <span className="text-text-muted tabular-nums">{role.permissions.length}</span>
      ),
    },
  ];

  return (
    <DataTable
      caption="Roles"
      columns={columns}
      rows={rows}
      rowKey={(role) => role.id}
      loading={roles.isPending}
      skeletonRows={7}
      onRowClick={(role) => open(role.id)}
      toolbar={
        <PageToolbar
          start={
            <CountTabs
              label="Role lists"
              items={[{ value: 'roles', label: 'Roles', count: roles.data?.length ?? null }]}
              value="roles"
            />
          }
        />
      }
      rowActions={(role) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`${canManage && !role.is_system ? 'Edit' : 'View'} role ${roleName(role)}`}
          onClick={() => open(role.id)}
        >
          {canManage && !role.is_system ? 'Edit' : 'View'}
        </Button>
      )}
      empty={
        <EmptyState
          icon={<ShieldCheck className="size-6" />}
          title="No roles"
          description="Roles group the permissions you give to staff."
          action={
            canManage ? <Button onClick={() => open(NEW)}>Create a custom role</Button> : undefined
          }
        />
      }
    />
  );
}

/** `/:orgSlug/settings/roles`. Needs `role.read`; editing needs `role.manage`. */
export default function RolesSettingsPage() {
  const { can } = useOrg();
  useDocumentTitle('Roles');
  const { params, setParam } = useUrlParams();
  const listing = !params.get('role');

  return (
    <SettingsSection
      title="Roles"
      description="A role is a set of permissions. The seven system roles are built in; custom roles are yours to shape."
      actions={
        can('role.read') && can('role.manage') && listing ? (
          <Button
            variant="primary"
            leftIcon={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => setParam({ role: NEW, from: null }, { push: true })}
          >
            New role
          </Button>
        ) : undefined
      }
    >
      {can('role.read') ? <RolesContent /> : <NoAccess what="roles" />}
    </SettingsSection>
  );
}
