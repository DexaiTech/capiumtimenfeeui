import { useDocumentTitle } from '@/hooks';

import { NumberingForm } from '../components/numbering/NumberingForm';
import { SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/credit-note-numbering`: the prefix, zero padding and next number of
 * credit notes. Any member reads it; `organization.update` saves.
 */
export default function CreditNoteNumberingPage() {
  useDocumentTitle('Credit note numbering');
  return (
    <SettingsSection
      title="Credit Note Numbering"
      description="The prefix, zero padding and next number of credit notes. A credit note takes the next number when it is created."
    >
      <NumberingForm kind="credit_note" />
    </SettingsSection>
  );
}
