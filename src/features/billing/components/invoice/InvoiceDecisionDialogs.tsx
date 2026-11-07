import { useToast } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { formatMoney } from '@/utils/money';

import { useApproveInvoice, useRejectInvoice } from '../../api';
import type { InvoiceSummary } from '../../types';
import { ReasonDialog } from '../ReasonDialog';

interface DecisionDialogProps {
  open: boolean;
  invoice: Pick<InvoiceSummary, 'id' | 'gross_total' | 'currency' | 'client'>;
  onClose: () => void;
}

/** Approves an invoice awaiting approval, with an optional note (the detail page and the list). */
export function ApproveInvoiceDialog({ open, invoice, onClose }: DecisionDialogProps) {
  const { can } = useOrg();
  const { toast } = useToast();
  const approve = useApproveInvoice();
  return (
    <ReasonDialog
      open={open}
      onClose={onClose}
      title="Approve this invoice?"
      description={`${formatMoney(invoice.gross_total, invoice.currency)} to ${invoice.client?.name ?? 'the client'}. The people who prepared it are told.`}
      label="Note (optional)"
      hint="Kept in the approval history."
      required={false}
      tone="primary"
      confirmLabel="Approve invoice"
      onSubmit={async (note) => {
        await approve.mutateAsync({ invoiceId: invoice.id, note: note || undefined });
        toast({
          tone: 'success',
          title: 'Invoice approved',
          description: can(P.invoiceIssue)
            ? 'It can be issued now.'
            : 'Someone who may issue invoices can issue it now.',
        });
      }}
    />
  );
}

/** Sends an invoice awaiting approval (or approved) back to draft; the reason is required. */
export function RejectInvoiceDialog({ open, invoice, onClose }: DecisionDialogProps) {
  const { toast } = useToast();
  const reject = useRejectInvoice();
  return (
    <ReasonDialog
      open={open}
      onClose={onClose}
      title="Reject this invoice?"
      description="It goes back to draft so it can be changed, and the people who prepared it are told why."
      label="Reason for rejecting"
      hint="Kept in the approval history."
      confirmLabel="Reject invoice"
      onSubmit={async (reason) => {
        await reject.mutateAsync({ invoiceId: invoice.id, reason });
        toast({
          tone: 'success',
          title: 'Invoice rejected',
          description: 'It is a draft again.',
        });
      }}
    />
  );
}
