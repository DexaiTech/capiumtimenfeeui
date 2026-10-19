import { useState } from 'react';

import { Button, ErrorState, Modal, Select, Skeleton } from '@/components/ui';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { formatMoney } from '@/utils/money';

import { useInvoice, useOpenInvoices } from '../../api';
import type { CreditNote } from '../../types';
import { dateCell } from '../../utils/format';
import { CreditNoteDialog } from '../CreditNoteDialog';
import { DialogActions } from '../DialogActions';

function ChooseInvoice({
  onChoose,
  onClose,
}: {
  onChoose: (invoiceId: string) => void;
  onClose: () => void;
}) {
  const { organization } = useOrg();
  const [clientId, setClientId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const open = useOpenInvoices(clientId);
  const invoices = open.data ?? [];

  return (
    <>
      <div className="flex flex-col gap-4">
        <ClientPicker
          label="Client"
          value={clientId}
          onChange={(client) => {
            setClientId(client?.id ?? null);
            setInvoiceId('');
          }}
          listPlacement="inline"
        />
        {clientId === null ? null : open.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : invoices.length === 0 ? (
          <p className="text-sm text-text-muted">
            This client has no issued invoice with a balance to credit.
          </p>
        ) : (
          <Select
            label="Invoice to credit"
            placeholder="Choose an invoice"
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
            options={invoices.map((invoice) => ({
              value: invoice.id,
              label: `${invoice.number ?? 'Invoice'} · ${dateCell(invoice.issue_date)} · outstanding ${formatMoney(invoice.balance, organization.currency)}`,
            }))}
          />
        )}
      </div>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={invoiceId === ''} onClick={() => onChoose(invoiceId)}>
          Continue
        </Button>
      </DialogActions>
    </>
  );
}

export interface CreditNoteLauncherProps {
  /** The invoice to credit, once chosen. */
  invoiceId: string;
  onClose: () => void;
  onCreated?: (note: CreditNote) => void;
}

/** Loads the invoice a credit note is raised against, then opens the credit note form for it. */
export function CreditNoteLauncher({ invoiceId, onClose, onCreated }: CreditNoteLauncherProps) {
  const query = useInvoice(invoiceId);
  if (query.data) {
    return <CreditNoteDialog open invoice={query.data} onClose={onClose} onCreated={onCreated} />;
  }
  return (
    <Modal open onClose={onClose} title="Raise a credit note">
      {query.isError ? (
        <ErrorState
          title="Could not load the invoice"
          error={isApiError(query.error) ? query.error : null}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : (
        <Skeleton className="h-32 w-full" />
      )}
    </Modal>
  );
}

export interface StartCreditNoteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the invoice the person chose; the caller opens the credit note form. */
  onChoose: (invoiceId: string) => void;
}

/** First step of a credit note raised from the list: the client and the invoice to credit. */
export function StartCreditNoteDialog({ open, onClose, onChoose }: StartCreditNoteDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise a credit note"
      description="Choose the issued invoice to credit. You then pick the lines and amounts."
      closeOnBackdrop={false}
    >
      {open ? <ChooseInvoice onChoose={onChoose} onClose={onClose} /> : null}
    </Modal>
  );
}
