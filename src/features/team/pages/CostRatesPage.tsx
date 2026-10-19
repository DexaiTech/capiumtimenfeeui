import { useOrg } from '@/features/organizations';
import { PERMISSIONS } from '@/constants/permissions';
import { useDocumentTitle } from '@/hooks';

import { NoAccess, PageShell } from '../components/PageShell';
import { RateRulesView } from '../components/rates/RateRulesView';

/** `/:orgSlug/team/cost-rates`: what each person and grade costs the practice per hour (`rate.read`). */
export default function CostRatesPage() {
  const { can } = useOrg();
  useDocumentTitle('Cost Rates');
  return (
    <PageShell
      title="Cost Rates"
      description="What each person and grade costs the practice per hour. A dated rate overrides the grade's default cost rate while it is in force."
    >
      {can(PERMISSIONS.rateRead) ? <RateRulesView kind="cost" /> : <NoAccess what="cost rates" />}
    </PageShell>
  );
}
