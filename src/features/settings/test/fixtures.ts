import type { Organization, OrganizationContext, RoleSummary } from '@/features/organizations';
import { testUser } from '@/test/fixtures';
import { testOrganization as baseOrganization } from '@/test/orgFixtures';

import type { AuditLogEntry, Member, Permission, Role } from '../types';

export const ORG_ID = '0198c1f2-1111-7000-8000-000000000001';

export const testOrganization: Organization = {
  ...baseOrganization,
  id: ORG_ID,
  name: 'Lovelace & Co',
  slug: 'lovelace',
};

export const testPermissions: Permission[] = [
  { code: 'audit_log.read', category: 'Audit', description: 'View the audit log' },
  { code: 'client.read', category: 'Clients', description: 'View clients and contacts' },
  { code: 'invoice.read', category: 'Billing', description: 'View invoices and credit notes' },
  { code: 'organization.delete', category: 'Practice', description: 'Delete the practice' },
  { code: 'organization.read', category: 'Practice', description: 'View practice details' },
  {
    code: 'organization.update',
    category: 'Practice',
    description: 'Change practice settings and numbering',
  },
  { code: 'role.manage', category: 'Roles', description: 'Create, edit and delete custom roles' },
  { code: 'role.read', category: 'Roles', description: 'View roles and their permissions' },
  { code: 'member.invite', category: 'Staff', description: 'Add staff accounts' },
  { code: 'member.read', category: 'Staff', description: 'View the staff list' },
  { code: 'member.remove', category: 'Staff', description: 'Remove staff' },
  {
    code: 'member.update',
    category: 'Staff',
    description: "Change a staff member's role, status and details",
  },
  { code: 'time.log', category: 'Time', description: 'Log own time and run a timer' },
];

export const ALL_PERMISSIONS = testPermissions.map((permission) => permission.code);
export const ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter((code) => code !== 'organization.delete');

const role = (
  id: string,
  name: string,
  systemKey: string | null,
  permissions: string[],
  memberCount: number,
  description: string | null = null,
): Role => ({
  id,
  name,
  system_key: systemKey,
  description,
  is_system: systemKey !== null,
  permissions,
  member_count: memberCount,
});

export const ownerRole = role(
  'role-owner',
  'Owner',
  'owner',
  ALL_PERMISSIONS,
  1,
  'Full control, including deleting the practice.',
);
export const adminRole = role('role-admin', 'Admin', 'admin', ADMIN_PERMISSIONS, 1);
export const staffRole = role(
  'role-staff',
  'Staff',
  'staff',
  ['organization.read', 'member.read', 'client.read', 'time.log'],
  2,
);
export const reviewerRole = role(
  'role-reviewer',
  'Reviewer',
  null,
  ['member.read', 'member.invite'],
  0,
  'Adds new staff.',
);
export const testRoles: Role[] = [ownerRole, adminRole, staffRole, reviewerRole];

export const summary = (source: Role): RoleSummary => ({
  id: source.id,
  name: source.name,
  system_key: source.system_key,
});

const member = (
  userId: string,
  fullName: string,
  email: string,
  source: Role,
  overrides: Partial<Member> = {},
): Member => ({
  user_id: userId,
  full_name: fullName,
  email,
  role: summary(source),
  status: 'active',
  manager_user_id: null,
  weekly_capacity_minutes: 2250,
  chargeable_target_bp: 7500,
  job_title: null,
  initials: null,
  must_change_password: false,
  joined_at: '2026-09-02T09:00:00Z',
  ...overrides,
});

/** The signed-in user (`testUser`) is Ada, the Owner. */
export const ada = member(testUser.id, 'Ada Lovelace', 'ada@example.com', ownerRole, {
  job_title: 'Managing partner',
  initials: 'AL',
});
export const grace = member('user-grace', 'Grace Hopper', 'grace@example.com', adminRole, {
  job_title: 'Practice manager',
  manager_user_id: testUser.id,
});
export const linus = member('user-linus', 'Linus Torvalds', 'linus@example.com', staffRole, {
  status: 'suspended',
});
export const margaret = member(
  'user-margaret',
  'Margaret Hamilton',
  'margaret@example.com',
  staffRole,
  { manager_user_id: 'user-grace', weekly_capacity_minutes: 1800, chargeable_target_bp: 8000 },
);
export const testMembers: Member[] = [ada, grace, linus, margaret];

export const auditEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 'audit-1',
  created_at: '2026-10-05T09:14:07Z',
  action: 'member.role_changed',
  // Empty wording: the page falls back to its own sentences and to the raw action.
  label: '',
  summary: '',
  actor: { id: testUser.id, full_name: 'Ada Lovelace', email: 'ada@example.com' },
  target_type: 'member',
  target_id: 'user-grace',
  ip_address: '203.0.113.7',
  user_agent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0',
  changes: [],
  metadata: { member_name: 'Grace Hopper', old_role_name: 'Staff', new_role_name: 'Admin' },
  ...overrides,
});

/** The practice context of the signed-in user, by default the Owner with every permission. */
export function orgContext(
  overrides: { role?: Role; permissions?: string[] } = {},
): OrganizationContext {
  const source = overrides.role ?? ownerRole;
  return {
    organization: testOrganization,
    role: summary(source),
    permissions: overrides.permissions ?? source.permissions,
  };
}
