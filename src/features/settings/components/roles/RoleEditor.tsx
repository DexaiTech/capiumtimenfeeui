import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Copy, Info, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import { Badge, Button, Input, Select, Textarea, useToast } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useRoleName } from '@/features/system';
import { isApiError } from '@/services/api';

import { useCreateRole, useSaveRole } from '../../api/hooks';
import { roleSchema, type RoleValues } from '../../schemas';
import type { Permission, Role } from '../../types';
import { missingPermissions } from '../../utils/roles';
import { DeleteRoleDialog } from './DeleteRoleDialog';
import { PermissionPicker } from './PermissionPicker';

const FIELDS = ['name', 'description', 'permissions'] as const;
const BLANK = '';

export interface RoleEditorProps {
  /** The role to show; null creates a new custom role. */
  role: Role | null;
  roles: ReadonlyArray<Role>;
  catalogue: ReadonlyArray<Permission>;
  /** For a new role: the role whose permissions to start from. */
  startFromId?: string | null;
  onBack: () => void;
  onCreated: (role: Role) => void;
  onDuplicate: (role: Role) => void;
}

function sameSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((code) => set.has(code));
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-info/40 bg-info-soft px-3 py-2.5 text-sm text-text">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

/** Detail view and editor of one role, and the form for a new custom role. */
export function RoleEditor({
  role,
  roles,
  catalogue,
  startFromId,
  onBack,
  onCreated,
  onDuplicate,
}: RoleEditorProps) {
  const { can } = useOrg();
  const { toast } = useToast();
  const roleName = useRoleName();
  const create = useCreateRole();
  const save = useSaveRole();
  const [deleting, setDeleting] = useState(false);

  const isNew = role === null;
  const canManage = can('role.manage');
  const missing = role ? missingPermissions(role, can) : [];
  const readOnly = !canManage || Boolean(role?.is_system) || missing.length > 0;

  // Catalogue order, so toggling a permission on and off again leaves the form pristine.
  const ordered = (codes: ReadonlyArray<string>) => {
    const known = catalogue
      .map((permission) => permission.code)
      .filter((code) => codes.includes(code));
    return [...known, ...codes.filter((code) => !known.includes(code))];
  };
  const grantable = (source: Role) => ordered(source.permissions.filter((code) => can(code)));
  const initialSource = isNew ? roles.find((item) => item.id === startFromId) : undefined;
  const [startFrom, setStartFrom] = useState(initialSource?.id ?? BLANK);
  const source = roles.find((item) => item.id === startFrom);
  const leftOut = source ? source.permissions.length - grantable(source).length : 0;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      permissions: role ? ordered(role.permissions) : initialSource ? grantable(initialSource) : [],
    },
  });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<RoleValues>({
    setError,
    fields: FIELDS,
  });

  const onError = (error: unknown) => {
    if (isApiError(error) && error.status === 409) {
      if (role?.is_system) {
        setError('root', { type: 'server', message: 'System roles cannot be changed.' });
      } else {
        setError(
          'name',
          { type: 'server', message: 'A role with this name already exists. Choose another name.' },
          { shouldFocus: true },
        );
      }
      return;
    }
    if (isApiError(error) && error.status === 403) {
      setError('root', {
        type: 'server',
        message:
          'The server refused this change: you can only grant permissions you hold yourself, and only edit roles whose permissions you all hold.',
      });
      return;
    }
    handleSubmitError(error);
  };

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    if (isNew) {
      create.mutate(
        {
          name: values.name,
          description: values.description || undefined,
          permissions: values.permissions,
        },
        {
          onSuccess: (created) => {
            toast({ tone: 'success', title: `Role “${created.name}” created` });
            onCreated(created);
          },
          onError,
        },
      );
      return;
    }
    const detailsChanged =
      values.name !== role.name || values.description !== (role.description ?? '');
    const permissionsChanged = !sameSet(values.permissions, role.permissions);
    if (!detailsChanged && !permissionsChanged) return;
    save.mutate(
      {
        roleId: role.id,
        details: detailsChanged
          ? { name: values.name, description: values.description }
          : undefined,
        permissions: permissionsChanged ? values.permissions : undefined,
      },
      {
        onSuccess: (saved) => {
          if (saved) {
            reset({
              name: saved.name,
              description: saved.description ?? '',
              permissions: ordered(saved.permissions),
            });
          }
          toast({ tone: 'success', title: 'Role saved' });
        },
        onError,
      },
    );
  });

  const pending = create.isPending || save.isPending;
  const startFromOptions = [
    { value: BLANK, label: 'Blank role' },
    ...roles.map((item) => ({ value: item.id, label: roleName(item) })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft aria-hidden="true" className="size-4" />}
          onClick={onBack}
          className="-ml-3"
        >
          All roles
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text">
              {isNew ? 'New role' : roleName(role)}
            </h3>
            {isNew ? null : role.is_system ? (
              <Badge tone="info">System</Badge>
            ) : (
              <Badge>Custom</Badge>
            )}
          </div>
          {isNew ? (
            <p className="text-sm text-text-muted">
              A custom role is a named set of permissions you can give to staff.
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              {role.member_count === 1 ? '1 staff member' : `${role.member_count} staff members`}
              {role.description && readOnly ? ` · ${role.description}` : ''}
            </p>
          )}
        </div>
        {!isNew && canManage ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              leftIcon={<Copy aria-hidden="true" className="size-4" />}
              onClick={() => onDuplicate(role)}
            >
              Duplicate
            </Button>
            {role.is_system ? null : (
              <Button
                size="sm"
                leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
                onClick={() => setDeleting(true)}
              >
                Delete role
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {!isNew && role.is_system ? (
        <Notice>
          <p>
            <strong className="font-medium">System roles are read-only.</strong> Owner, Admin,
            Partner, Manager, Staff, Billing and Viewer are built in and mean the same in every
            practice, so they cannot be renamed, changed or deleted.
            {canManage ? ' To adjust access, duplicate this role and edit the copy.' : ''}
          </p>
        </Notice>
      ) : !isNew && !canManage ? (
        <Notice>
          <p>Your role lets you view roles but not change them.</p>
        </Notice>
      ) : missing.length > 0 ? (
        <Notice>
          <p>
            <strong className="font-medium">You can't edit this role.</strong> It holds{' '}
            {missing.length === 1 ? '1 permission' : `${missing.length} permissions`} you don't have
            yourself, and a role can only be changed by someone who holds everything in it.
          </p>
        </Notice>
      ) : null}

      <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-6">
        {readOnly ? null : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              label="Name"
              autoComplete="off"
              error={errors.name?.message}
              {...register('name')}
            />
            {isNew ? (
              <Select
                label="Start from"
                options={startFromOptions}
                value={startFrom}
                onChange={(event) => {
                  const next = roles.find((item) => item.id === event.target.value);
                  setStartFrom(next?.id ?? BLANK);
                  setValue('permissions', next ? grantable(next) : [], { shouldDirty: true });
                }}
                hint={
                  leftOut > 0
                    ? `Left out ${leftOut === 1 ? '1 permission' : `${leftOut} permissions`} of that role that you don't hold yourself.`
                    : 'Copies the permissions of an existing role as a starting point.'
                }
              />
            ) : null}
            <Textarea
              label="Description"
              rows={2}
              hint="Optional. Tell admins when to use this role."
              error={errors.description?.message}
              className="lg:col-span-2"
              {...register('description')}
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-text">Permissions</h4>
          <Controller
            control={control}
            name="permissions"
            render={({ field }) => (
              <PermissionPicker
                catalogue={catalogue}
                value={field.value}
                onChange={field.onChange}
                held={can}
                readOnly={readOnly}
                error={errors.permissions?.message}
              />
            )}
          />
        </div>

        {errors.root?.message ? <FormAlert message={errors.root.message} /> : null}
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}

        {readOnly ? null : (
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button onClick={onBack}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={(!isNew && !isDirty) || retryIn > 0}
            >
              {isNew ? 'Create role' : 'Save changes'}
            </Button>
          </div>
        )}
      </form>

      {role && !role.is_system ? (
        <DeleteRoleDialog
          role={role}
          open={deleting}
          onClose={() => setDeleting(false)}
          onDeleted={onBack}
        />
      ) : null}
    </div>
  );
}
