import { UserRound } from 'lucide-react';

import { Card, EmptyState } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { PrepareFlow } from '../components/prepare/PrepareFlow';
import { NoAccess, PageShell } from '../components/PageShell';

/** /:orgSlug/billing/prepare: Choose a client and the work to bill, then review and issue the invoice. */
export default function PrepareInvoicePage() {
  useDocumentTitle('Prepare Invoice');
  const { can } = useOrg();
  const { params, setParam } = useUrlParams();
  const clientId = params.get('client');

  return (
    <PageShell
      title="Prepare Invoice"
      description="Choose a client and the work to bill, then review and issue the invoice."
    >
      {!can(P.invoiceCreate) ? (
        <NoAccess what="invoice preparation" />
      ) : (
        <>
          <Card padding="sm">
            <ClientPicker
              label="Client"
              required
              value={clientId}
              onChange={(client) => setParam({ client: client?.id ?? null })}
              listPlacement="inline"
            />
          </Card>
          {clientId ? (
            // Another client starts again from the first step.
            <PrepareFlow key={clientId} clientId={clientId} />
          ) : (
            <Card padding="none">
              <EmptyState
                icon={<UserRound className="size-6" />}
                title="Choose a client"
                description="Their unbilled time, disbursements and fixed fees are listed so you can pick what goes on the invoice."
              />
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
