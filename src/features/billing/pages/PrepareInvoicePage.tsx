import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { PrepareInvoicePanel } from '../components/prepare/PrepareInvoicePanel';
import { NoAccess, PageShell } from '../components/PageShell';

/** /:orgSlug/billing/prepare: Choose a client and the work to bill, then review and issue the invoice. */
export default function PrepareInvoicePage() {
  useDocumentTitle('Create Invoice');
  const { can } = useOrg();
  const { params, setParam } = useUrlParams();
  const clientId = params.get('client');

  return (
    <PageShell
      title="Create Invoice"
      description="Choose a client and the work to bill, then review and issue the invoice."
    >
      {!can(P.invoiceCreate) ? (
        <NoAccess what="invoice preparation" />
      ) : (
        <PrepareInvoicePanel
          clientId={clientId}
          onClientChange={(id) => setParam({ client: id })}
          preselect={params.get('time')?.split(',').filter(Boolean) ?? []}
        />
      )}
    </PageShell>
  );
}
