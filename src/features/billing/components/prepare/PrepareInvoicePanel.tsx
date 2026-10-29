import { UserRound, X } from 'lucide-react';

import { Button, Card, EmptyState } from '@/components/ui';
import { ClientPicker } from '@/features/clients';

import { PrepareFlow } from './PrepareFlow';

export interface PrepareInvoicePanelProps {
  /** The client being invoiced, or null while none is chosen. */
  clientId: string | null;
  onClientChange: (clientId: string | null) => void;
  /** Time entries to have chosen when the work is listed (time picked on the Time Entries page). */
  preselect?: ReadonlyArray<string>;
  /** When given, the panel has a title and a Close button (it opens inside another page). */
  onClose?: () => void;
}

/** Choose a client, then the work to bill, review the lines and make the draft. */
export function PrepareInvoicePanel({
  clientId,
  onClientChange,
  preselect = [],
  onClose,
}: PrepareInvoicePanelProps) {
  const body = (
    <>
      <Card padding="sm">
        <ClientPicker
          label="Client"
          required
          value={clientId}
          onChange={(client) => onClientChange(client?.id ?? null)}
          listPlacement="inline"
        />
      </Card>
      {clientId ? (
        // Another client starts again from the first step.
        <PrepareFlow key={clientId} clientId={clientId} preselect={preselect} />
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
  );
  if (!onClose) return body;
  return (
    <section
      aria-label="Create invoice"
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface-sunken p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-text">Create invoice</h2>
          <p className="text-sm text-text-muted">
            Choose a client and the work to bill, then review and issue the invoice.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<X aria-hidden="true" className="size-4" />}
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      {body}
    </section>
  );
}
