import { useDocumentTitle, useUrlParams } from '@/hooks';
import { SegmentedControl } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';

import { DebtorsView } from '../components/debtors/DebtorsView';
import { ReminderLogView } from '../components/debtors/ReminderLogView';
import { NoAccess, PageShell } from '../components/PageShell';

const VIEWS = [
  { value: 'debtors', label: 'Debtors' },
  { value: 'reminders', label: 'Reminders sent' },
] as const;

/** `/:orgSlug/billing/debtors`: who owes the practice money, by how late it is, and the reminders. */
export default function DebtorsPage() {
  useDocumentTitle('Debtors');
  const { can } = useOrg();
  const { params, setParam } = useUrlParams();
  const view = VIEWS.find((item) => item.value === params.get('view'))?.value ?? 'debtors';
  const allowed = can(P.paymentRead) || can(P.invoiceRead) || can(P.reportFinancial);

  return (
    <PageShell
      title="Debtors"
      description="Who owes the practice money, by how late it is."
      actions={
        allowed ? (
          <SegmentedControl
            label="View"
            options={VIEWS}
            value={view}
            // Each view has its own filters: leave the other's behind.
            onChange={(value) =>
              setParam({
                view: value === 'debtors' ? null : value,
                as_at: null,
                sort: null,
                order: null,
                client: null,
                partner: null,
                manager: null,
                min: null,
                status: null,
                source: null,
                from: null,
                to: null,
              })
            }
          />
        ) : undefined
      }
    >
      {!allowed ? (
        <NoAccess what="the debtors" />
      ) : view === 'reminders' ? (
        <ReminderLogView />
      ) : (
        <DebtorsView />
      )}
    </PageShell>
  );
}
