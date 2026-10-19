import type { RoleSummary } from '@/features/organizations';

import type { Permission, Role } from '../types';

export const OWNER_KEY = 'owner';

export interface Grantor {
  role: RoleSummary;
  can: (permission: string) => boolean;
}

export type Assignability =
  { assignable: true } | { assignable: false; reason: 'owner_only' | 'missing_permissions' };

/**
 * Mirrors the server's grant rules (docs/api.md, Members): only an Owner can give the
 * Owner role, and a caller can assign only a role whose permissions they all hold.
 */
export function assignability(role: Role, grantor: Grantor): Assignability {
  if (role.system_key === OWNER_KEY && grantor.role.system_key !== OWNER_KEY) {
    return { assignable: false, reason: 'owner_only' };
  }
  if (!role.permissions.every((code) => grantor.can(code))) {
    return { assignable: false, reason: 'missing_permissions' };
  }
  return { assignable: true };
}

export interface RoleOption {
  value: string;
  label: string;
  disabled: boolean;
}

/** Options for a role select. A native option cannot carry a tooltip, so the reason is in the label. */
export function roleOptions(
  roles: ReadonlyArray<Role>,
  grantor: Grantor,
  /** The name to show for a role (the owner is the "Super admin" of a closed deployment). */
  nameOf: (role: Role) => string = (role) => role.name,
): RoleOption[] {
  return roles.map((role) => {
    const name = nameOf(role);
    const result = assignability(role, grantor);
    if (result.assignable) return { value: role.id, label: name, disabled: false };
    return {
      value: role.id,
      label:
        result.reason === 'owner_only'
          ? `${name} (only ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name} can assign)`
          : `${name} (has permissions you lack)`,
      disabled: true,
    };
  });
}

/** A role can be edited only by someone who holds every permission in it. */
export function missingPermissions(role: Role, can: (permission: string) => boolean): string[] {
  return role.permissions.filter((code) => !can(code));
}

export interface PermissionGroup {
  category: string;
  permissions: Permission[];
}

/** Groups the catalogue by category, keeping the API's order (category, then code). */
export function groupPermissions(catalogue: ReadonlyArray<Permission>): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();
  for (const permission of catalogue) {
    const list = groups.get(permission.category);
    if (list) list.push(permission);
    else groups.set(permission.category, [permission]);
  }
  return Array.from(groups, ([category, permissions]) => ({ category, permissions }));
}
