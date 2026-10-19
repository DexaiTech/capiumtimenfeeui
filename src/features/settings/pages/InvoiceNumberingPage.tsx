import { useDocumentTitle } from '@/hooks';

import { NumberingForm } from '../components/numbering/NumberingForm';
import { SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/invoice-numbering`: the prefix, zero padding and next number of invoices.
 * Any member reads it; `organization.update` saves.
 */
export default function InvoiceNumberingPage() {
  useDocumentTitle('Invoice numbering');
  return (
    <SettingsSection
      title="Invoice Numbering"
      description="The prefix, zero padding and next number of invoices. An invoice takes the next number when it is issued."
    >
      <NumberingForm kind="invoice" />
    </SettingsSection>
  );
}
