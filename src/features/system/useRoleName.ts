import { useCallback } from 'react';

import { roleDisplayName } from './roleName';
import { useSystemInfo } from './useSystemInfo';

/** `roleName(role)` for components: applies the "Super admin" naming of a closed deployment. */
export function useRoleName(): (role: { name: string; system_key?: string | null }) => string {
  const { closed } = useSystemInfo();
  return useCallback((role) => roleDisplayName(role, closed), [closed]);
}
