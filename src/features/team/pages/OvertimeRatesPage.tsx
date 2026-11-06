import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { OvertimeRatesView } from '../components/overtime/OvertimeRatesView';
import { NoAccess, PageShell } from '../components/PageShell';

/** `/:orgSlug/team/overtime-rates`: what an hour of overtime costs the practice (`rate.read`). */
export default function OvertimeRatesPage() {
  const { can } = useOrg();
  useDocumentTitle('Overtime Rates');
  return (
    <PageShell
      title="Overtime Rates"
      description="What an hour of overtime costs the practice, for a grade or one staff member. Overtime rates are an internal cost only and never change charge-out. One rate applies: a staff member's own rate replaces their grade's rate, never added to it."
    >
      {can(PERMISSIONS.rateRead) ? <OvertimeRatesView /> : <NoAccess what="overtime rates" />}
    </PageShell>
  );
}
