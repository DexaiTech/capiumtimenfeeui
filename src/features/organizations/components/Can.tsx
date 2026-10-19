import type { ReactNode } from 'react';

import { useOrg } from '../orgContext';

export interface CanProps {
  /** A permission code, for example `member.invite`. */
  permission: string;
  /** Rendered instead when the permission is missing. Nothing by default. */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Hides what the API would reject. It never replaces the server-side check. */
export function Can({ permission, fallback = null, children }: CanProps) {
  const { can } = useOrg();
  return <>{can(permission) ? children : fallback}</>;
}
