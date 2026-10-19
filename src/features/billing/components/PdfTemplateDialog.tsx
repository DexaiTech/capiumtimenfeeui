import { useState } from 'react';

import { Button, Modal, Select, Skeleton } from '@/components/ui';
import { useInvoiceTemplates, type InvoiceTemplate } from '@/features/settings';
import { useOrg } from '@/features/organizations';

import { billingApi } from '../api';
import { useFileDownload } from '../hooks/useFileDownload';
import type { InvoiceSummary } from '../types';
import { DialogActions } from './DialogActions';

export interface PdfTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Pick<InvoiceSummary, 'id' | 'number'>;
}

const LAYOUTS: Record<InvoiceTemplate['layout'], string> = {
  standard: 'standard layout',
  detailed: 'detailed: every time entry',
  summary: 'summary: one line per job',
};

function PdfForm({ invoice, onClose }: Omit<PdfTemplateDialogProps, 'open'>) {
  const { organization } = useOrg();
  const { busy, download } = useFileDownload();
  const templates = useInvoiceTemplates({ includeInactive: false });
  const [templateId, setTemplateId] = useState('');

  if (templates.isLoading) return <Skeleton className="h-16 w-full" />;
  const options = [
    { value: '', label: "The client's template (what the email uses)" },
    ...(templates.data ?? []).map((template) => ({
      value: template.id,
      label: `${template.name}${template.is_default ? ' (practice default)' : ''} · ${LAYOUTS[template.layout]}`,
    })),
  ];

  return (
    <>
      <div className="flex flex-col gap-3">
        <Select
          label="Layout"
          options={options}
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          hint="Previews the invoice with another template. The invoice itself is not changed: the PDF and the email use the client's template."
        />
      </div>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="primary"
          loading={busy === invoice.id}
          onClick={() =>
            void download(invoice.id, `${invoice.number ?? 'draft-invoice'}.pdf`, () =>
              billingApi.invoicePdf(organization.id, invoice.id, templateId || undefined),
            ).then(onClose)
          }
        >
          Download PDF
        </Button>
      </DialogActions>
    </>
  );
}

/** Downloads the invoice PDF laid out with a template of the practice's choice (a preview). */
export function PdfTemplateDialog({ open, onClose, invoice }: PdfTemplateDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Download PDF with a template">
      {open ? <PdfForm invoice={invoice} onClose={onClose} /> : null}
    </Modal>
  );
}
