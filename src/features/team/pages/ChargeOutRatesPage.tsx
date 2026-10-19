import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { NoAccess, PageShell } from '../components/PageShell';
import { ChargeLadderPanel } from '../components/rates/ChargeLadderPanel';
import { RateRulesView } from '../components/rates/RateRulesView';

/** `/:orgSlug/team/charge-out-rates`: what the practice charges per hour, by staff, grade, service and client (`rate.read`). */
export default function ChargeOutRatesPage() {
  const { can } = useOrg();
  useDocumentTitle('Charge-out Rates');
  return (
    <PageShell
      title="Charge-out Rates"
      description="What the practice charges per hour, by staff, grade, service and client. The most specific rate in force on the day of an entry is the one it is charged at."
    >
      {can(PERMISSIONS.rateRead) ? (
        <>
          <ChargeLadderPanel />
          <RateRulesView kind="charge" />
        </>
      ) : (
        <NoAccess what="charge-out rates" />
      )}
    </PageShell>
  );
}
