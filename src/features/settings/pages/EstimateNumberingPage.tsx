import { useDocumentTitle } from '@/hooks';

import { NumberingForm } from '../components/numbering/NumberingForm';
import { SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/estimate-numbering`: the prefix, zero padding and next number of
 * estimates. Any member reads it; `organization.update` saves. Until the API lists the
 * `estimate` sequence the page explains that it is not available yet.
 */
export default function EstimateNumberingPage() {
  useDocumentTitle('Estimate numbering');
  return (
    <SettingsSection
      title="Estimate Numbering"
      description="The prefix, zero padding and next number of estimates."
    >
      <NumberingForm kind="estimate" />
    </SettingsSection>
  );
}
