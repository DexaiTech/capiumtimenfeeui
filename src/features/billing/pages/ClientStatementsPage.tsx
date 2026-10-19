import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { NoAccess, PageShell } from '../components/PageShell';
import { StatementsView } from '../components/statements/StatementsView';

/** /:orgSlug/billing/statements: A client's invoices, credit notes and payments with a running balance. */
export default function ClientStatementsPage() {
  useDocumentTitle('Client Statements');
  const { can } = useOrg();
  // The statement endpoints need both permissions.
  const allowed = can(P.invoiceRead) && can(P.paymentRead);

  return (
    <PageShell
      title="Client Statements"
      description="A client's invoices, credit notes and payments with a running balance."
    >
      {allowed ? <StatementsView /> : <NoAccess what="client statements" />}
    </PageShell>
  );
}
