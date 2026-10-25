import { PageHeader } from '@/components/layout';
import { Tabs, type TabItem } from '@/components/ui';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { GlossaryTab } from '../components/GlossaryTab';
import { HowItWorksTab } from '../components/HowItWorksTab';
import { ShortcutsTab } from '../components/ShortcutsTab';
import { SupportTab } from '../components/SupportTab';

const TABS = [
  { value: 'how-it-works', label: 'How it works' },
  { value: 'glossary', label: 'Glossary' },
  { value: 'shortcuts', label: 'Shortcuts' },
  { value: 'support', label: 'Get help' },
] as const satisfies ReadonlyArray<TabItem>;

type HelpTab = (typeof TABS)[number]['value'];

/** `/:orgSlug/help`: the product on one page, the words it uses, the shortcuts and where to ask. */
export default function HelpPage() {
  useDocumentTitle('Help');
  const { params, setParam } = useUrlParams();
  const tab: HelpTab =
    TABS.find((item) => item.value === params.get('tab'))?.value ?? 'how-it-works';
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Help"
        description="How the product fits together, what its words mean, and where to ask."
      />
      <Tabs
        label="Help sections"
        idBase="help"
        items={TABS}
        value={tab}
        onChange={(value) => setParam({ tab: value === 'how-it-works' ? null : value })}
      />
      <div role="tabpanel" id={`help-panel-${tab}`} aria-labelledby={`help-tab-${tab}`}>
        {tab === 'how-it-works' ? <HowItWorksTab /> : null}
        {tab === 'glossary' ? <GlossaryTab /> : null}
        {tab === 'shortcuts' ? <ShortcutsTab /> : null}
        {tab === 'support' ? <SupportTab /> : null}
      </div>
    </div>
  );
}
