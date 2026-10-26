/** Grants and denials that turn the role's permissions into the wanted ones. */
export function overridesFor(
  rolePermissions: ReadonlyArray<string>,
  wanted: ReadonlyArray<string>,
): { grants: string[]; denies: string[] } {
  const role = new Set(rolePermissions);
  const chosen = new Set(wanted);
  return {
    grants: wanted.filter((code) => !role.has(code)),
    denies: rolePermissions.filter((code) => !chosen.has(code)),
  };
}
