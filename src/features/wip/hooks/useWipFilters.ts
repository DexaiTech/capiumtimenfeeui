import { useUrlParams } from '@/hooks';

import type { WipFilters } from '../types';

const KEYS = ['client_id', 'job_id', 'partner_user_id', 'manager_user_id', 'service_id'] as const;

/** Clears every shared filter: merge it into one `setParam` call (calls in a row do not queue). */
export const CLEARED_FILTERS: Record<string, null> = Object.fromEntries(
  KEYS.map((key) => [key, null]),
);

/** The filters every WIP view shares, read from and written to the address. */
export function useWipFilters() {
  const { params, setParam } = useUrlParams();

  const filters: WipFilters = {
    client_id: params.get('client_id') ?? undefined,
    job_id: params.get('job_id') ?? undefined,
    partner_user_id: params.get('partner_user_id') ?? undefined,
    manager_user_id: params.get('manager_user_id') ?? undefined,
    service_id: params.get('service_id') ?? undefined,
  };
  const active = KEYS.filter((key) => filters[key] !== undefined).length;

  return { filters, active, setFilters: setParam, clear: () => setParam(CLEARED_FILTERS) };
}
