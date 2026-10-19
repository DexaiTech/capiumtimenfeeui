/** What the owner role is called in a closed deployment. */
export const SUPER_ADMIN_NAME = 'Super admin';

interface NamedRole {
  name: string;
  system_key?: string | null;
}

/** The name to show for a role: the owner is the "Super admin" of a closed deployment. */
export function roleDisplayName(role: NamedRole, closed: boolean): string {
  return closed && role.system_key === 'owner' ? SUPER_ADMIN_NAME : role.name;
}
