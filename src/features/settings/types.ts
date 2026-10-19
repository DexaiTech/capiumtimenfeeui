/**
 * Shapes of the staff, role, permission and audit endpoints (`app/schemas/organization.py`,
 * `app/schemas/audit.py`) that only the settings area uses.
 */
import type { AuditChange } from '@/features/audit';
import type { RoleSummary } from '@/features/organizations';

/**
 * `suspended` and `removed` are the V1 names of `inactive` and `left` (the Team module's
 * vocabulary); the members endpoints return both.
 */
export type MemberStatus = 'active' | 'suspended' | 'removed' | 'inactive' | 'left';

/** A member of the practice: a person on the staff list (`MemberRead`). */
export interface Member {
  user_id: string;
  full_name: string;
  email: string;
  role: RoleSummary;
  status: MemberStatus;
  manager_user_id: string | null;
  /** Weekly capacity in minutes (2250 = 37.5 hours). */
  weekly_capacity_minutes: number;
  /** Chargeable target in basis points (7500 = 75%). */
  chargeable_target_bp: number;
  job_title: string | null;
  /** Initials shown on timesheets and reports; derived from the name when null. */
  initials: string | null;
  /** True until the person replaces the temporary password they were given. */
  must_change_password: boolean;
  joined_at: string;
}

export interface Role {
  id: string;
  name: string;
  /** Null for custom roles. */
  system_key: string | null;
  description: string | null;
  is_system: boolean;
  /** Permission codes. */
  permissions: string[];
  member_count: number;
}

export interface Permission {
  code: string;
  category: string;
  description: string;
}

export interface AuditLogEntry {
  id: string;
  created_at: string;
  action: string;
  /** The action in words ("Invoice issued"); empty only when the API did not send one. */
  label: string;
  /** The label with the record it is about ("Invoice issued: INV-00012 (Babbage Ltd)"). */
  summary: string;
  /** Null for events written by the system. */
  actor: { id: string; full_name: string; email: string } | null;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  /** What the action changed, normalised by the API; empty for a creation or a deletion. */
  changes: AuditChange[];
  metadata: Record<string, unknown> | null;
}

/** Query filters of GET {org}/members. `status` undefined means active and suspended. */
export interface MemberFilters {
  q?: string;
  role_id?: string;
  status?: MemberStatus;
}

export interface RoleCreate {
  name: string;
  description?: string;
  permissions: string[];
}

export interface RoleUpdate {
  name?: string;
  description?: string;
}

/** Query filters of GET {org}/audit-logs (and of the export, which takes the same). */
export interface AuditLogFilters {
  /** Exact action, or a prefix ending in `.` such as `invoice.`. */
  action?: string;
  actor_user_id?: string;
  /** ISO timestamps. */
  from?: string;
  to?: string;
  /** Only entries about records of this type (`client`, `invoice` …). */
  target_type?: string;
  /** Text search over the action, record type, address, person and recorded details. */
  q?: string;
}
