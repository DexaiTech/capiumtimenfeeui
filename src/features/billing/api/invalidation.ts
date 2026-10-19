import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

/**
 * What to refresh after each kind of change. Everything is only marked stale and refetched when
 * something shows it, so listing the neighbours is cheap: an invoice change reaches the client
 * workspace, WIP, the dashboard, the reports and the debtors; a payment the same figures.
 */
export function useBillingInvalidation() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;
  const refresh = (...keys: ReadonlyArray<readonly unknown[]>) => {
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };
  const k = queryKeys.org;
  const money = [k.clients(id), k.dashboard(id), k.reports(id), k.debtors(id), k.statements(id)];

  return {
    invoices: () => refresh(k.invoices(id), k.wip(id), ...money, k.auditLogs(id)),
    creditNotes: () =>
      refresh(k.creditNotes(id), k.invoices(id), k.wip(id), ...money, k.auditLogs(id)),
    payments: () => refresh(k.payments(id), k.invoices(id), ...money, k.auditLogs(id)),
    statements: () => refresh(k.statements(id), k.auditLogs(id)),
  };
}
