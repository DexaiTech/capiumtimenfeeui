import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button, SegmentedControl } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { AdjustmentFormDialog } from '../components/AdjustmentFormDialog';
import { AdjustmentsView } from '../components/AdjustmentsView';
import { LedgerView } from '../components/LedgerView';
import { PageShell } from '../components/PageShell';
import { WriteOffsView } from '../components/WriteOffsView';

type View = 'adjustments' | 'write-offs' | 'ledger';

const VIEWS = [
  { value: 'adjustments', label: 'Adjustments' },
  { value: 'write-offs', label: 'Write-offs' },
  { value: 'ledger', label: 'Ledger' },
] as const;

/**
 * /:orgSlug/wip/adjustments: write-ons and write-offs of an amount and their approval, the items
 * written off from the WIP details, and the WIP ledger.
 */
export default function WipAdjustmentsPage() {
  useDocumentTitle('WIP Adjustments');
  const { can } = useOrg();
  const { params, setParam } = useUrlParams();
  const view: View =
    VIEWS.find((item) => item.value === params.get('view'))?.value ?? 'adjustments';
  const canAdjust = can(PERMISSIONS.wipAdjust);
  const [creating, setCreating] = useState(false);

  return (
    <PageShell
      title="WIP Adjustments"
      description="Write work in progress on or off with a reason; larger amounts wait for approval. Items written off from the WIP details can be reversed under Write-offs, and the ledger records every movement."
      actions={
        <>
          <SegmentedControl
            label="View"
            options={VIEWS}
            value={view}
            // A view has its own filters: leave the ones of the other behind.
            onChange={(value) =>
              setParam({
                view: value === 'adjustments' ? null : value,
                status: null,
                source: null,
                kind: null,
                client_id: null,
                job_id: null,
                date_from: null,
                date_to: null,
              })
            }
          />
          {canAdjust ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => setCreating(true)}
            >
              Adjust WIP
            </Button>
          ) : null}
        </>
      }
    >
      {view === 'ledger' ? (
        <LedgerView />
      ) : view === 'write-offs' ? (
        <WriteOffsView />
      ) : (
        <AdjustmentsView onCreate={() => setCreating(true)} />
      )}
      <AdjustmentFormDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}
