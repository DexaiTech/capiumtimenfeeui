import { http, type HttpHandler } from 'msw';

import { apiPath, fail, ok } from '@/test/server';

import type { AuditLogEntry, Member, Permission, Role } from '../types';
import { ORG_ID, testMembers, testPermissions, testRoles } from './fixtures';

export const orgPath = (path: string) => apiPath(`/organizations/${ORG_ID}${path}`);

const END = { next_cursor: null, has_more: false };

export interface SettingsData {
  members?: Member[];
  roles?: Role[];
  permissions?: Permission[];
  auditLogs?: AuditLogEntry[];
}

/**
 * Read handlers for the settings endpoints with the real envelope shapes and filters.
 * Tests add the mutations they exercise.
 */
export function settingsHandlers(data: SettingsData = {}): HttpHandler[] {
  const members = data.members ?? testMembers;
  const roles = data.roles ?? testRoles;
  return [
    http.get(orgPath('/members'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get('q')?.toLowerCase();
      const status = params.get('status');
      const roleId = params.get('role_id');
      const rows = members.filter(
        (member) =>
          (status ? member.status === status : member.status !== 'removed') &&
          (!roleId || member.role.id === roleId) &&
          (!q ||
            member.full_name.toLowerCase().includes(q) ||
            member.email.toLowerCase().includes(q)),
      );
      return ok(rows, { meta: END });
    }),
    http.get(orgPath('/members/:userId'), ({ params }) => {
      const found = members.find((member) => member.user_id === params.userId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
    }),
    http.get(orgPath('/roles'), () => ok(roles)),
    http.get(apiPath('/permissions'), () => ok(data.permissions ?? testPermissions)),
    http.get(orgPath('/audit-logs'), () => ok(data.auditLogs ?? [], { meta: END })),
  ];
}
