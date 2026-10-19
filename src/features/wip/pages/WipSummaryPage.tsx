import { useDocumentTitle } from '@/hooks';

import { PageShell } from '../components/PageShell';
import { SummaryView } from '../components/SummaryView';

/** /:orgSlug/wip: Unbilled work in progress by client, job, partner, manager or service. */
export default function WipSummaryPage() {
  useDocumentTitle('WIP Summary');
  return (
    <PageShell
      title="WIP Summary"
      description="Unbilled work in progress by client, job, partner, manager or service."
    >
      <SummaryView variant="summary" />
    </PageShell>
  );
}
