import { useUrlParams } from '@/hooks';
import { parsePounds } from '@/utils/money';

const CLEARED = { client: null, partner: null, manager: null, min: null } as const;

/** The filters the debtors and the statements share, kept in the URL (`min` is pounds as typed). */
export function useBalanceFilters() {
  const { params, setParam } = useUrlParams();
  const client = params.get('client');
  const partner = params.get('partner');
  const manager = params.get('manager');
  const minText = params.get('min') ?? '';
  const parsed = minText === '' ? null : parsePounds(minText);
  const minPence = parsed !== null && parsed > 0 ? parsed : null;
  const active = [client, partner, manager].filter(Boolean).length + (minPence === null ? 0 : 1);

  return {
    client,
    partner,
    manager,
    minText,
    minPence,
    active,
    setParam,
    clear: () => setParam(CLEARED),
  };
}

export type BalanceFilters = ReturnType<typeof useBalanceFilters>;
