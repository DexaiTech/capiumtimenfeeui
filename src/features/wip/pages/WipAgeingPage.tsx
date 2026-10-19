import { useDocumentTitle } from '@/hooks';

import { PageShell } from '../components/PageShell';
import { SummaryView } from '../components/SummaryView';

/** /:orgSlug/wip/ageing: Unbilled work in progress by the age of its items. */
export default function WipAgeingPage() {
  useDocumentTitle('WIP Ageing');
  return (
    <PageShell
      title="WIP Ageing"
      description="How old the unbilled work is: 0-30, 31-60, 61-90 and over 90 days, by the date of each item."
    >
      <SummaryView variant="ageing" />
    </PageShell>
  );
}
