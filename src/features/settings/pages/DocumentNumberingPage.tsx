import { useState } from 'react';

import { Tabs } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';

import { NumberingForm } from '../components/numbering/NumberingForm';
import { SettingsSection } from '../components/SettingsSection';
import type { NumberedDocument } from '../billingTypes';
import { NUMBERED_DOCUMENTS } from '../utils/numbering';

const TABS = (Object.keys(NUMBERED_DOCUMENTS) as NumberedDocument[]).map((kind) => ({
  value: kind,
  label: NUMBERED_DOCUMENTS[kind].title.replace(' numbering', ''),
}));

/**
 * `/:orgSlug/settings/document-numbering`: the prefix, zero padding and next number of
 * invoices, credit notes and estimates, one tab each. Replaces the three separate numbering
 * pages (`invoice-numbering`, `credit-note-numbering`, `estimate-numbering`), whose URLs now
 * redirect here (`app/router/routes.tsx`). Each tab is the same `NumberingForm` as before,
 * unchanged; only the page around it is new.
 */
export default function DocumentNumberingPage() {
  useDocumentTitle('Document numbering');
  const [tab, setTab] = useState<NumberedDocument>('invoice');

  return (
    <SettingsSection
      title="Document Numbering"
      description="The prefix, zero padding and next number for each document type."
    >
      <Tabs
        label="Document type"
        idBase="document-numbering"
        items={TABS}
        value={tab}
        onChange={setTab}
      />
      <div
        role="tabpanel"
        id={`document-numbering-panel-${tab}`}
        aria-labelledby={`document-numbering-tab-${tab}`}
        className="flex flex-col gap-5"
      >
        {/* Remounts on every tab switch: without this, an unsaved, dirty field from one
            document type's form could bleed into the next one's values (NumberingForm's
            `keepDirtyValues` reset option is meant to survive a refetch of the SAME kind, not
            a switch to a different one). */}
        <NumberingForm key={tab} kind={tab} />
      </div>
    </SettingsSection>
  );
}
