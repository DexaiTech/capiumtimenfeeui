import { useState } from 'react';
import { Link } from 'react-router';

import { Badge, Tabs } from '@/components/ui';
import { ORG_SEGMENTS, modulePath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { cn } from '@/utils/cn';

import { BillingSettingsCard } from '../components/general/BillingSettingsCard';
import { ExpenseSettingsCard } from '../components/general/ExpenseSettingsCard';
import { LocaleSettingsCard } from '../components/general/LocaleSettingsCard';
import { RateModeCard } from '../components/general/RateModeCard';
import { TimeSettingsCard } from '../components/general/TimeSettingsCard';
import { SettingsSection } from '../components/SettingsSection';

type GeneralTab = 'time' | 'billing' | 'rates' | 'expenses' | 'locale';

const TABS: ReadonlyArray<{ value: GeneralTab; label: string }> = [
  { value: 'time', label: 'Time recording' },
  { value: 'billing', label: 'WIP & billing' },
  { value: 'rates', label: 'Rates' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'locale', label: 'Locale' },
];

/**
 * `/:orgSlug/settings/general`: how time, WIP, billing, rates and expenses behave across the
 * practice, one tab each so that reaching any of them never needs scrolling past another.
 * Companion to Practice Settings (name, address, VAT and bank details), which edits the same
 * practice through the same endpoint. Each tab is still its own independent form with its own
 * save, exactly as before; only the five cards are now shown one at a time instead of stacked.
 */
export default function GeneralSettingsPage() {
  const { organization, can } = useOrg();
  useDocumentTitle('General settings');
  const editable = can(PERMISSIONS.organizationUpdate);
  const [tab, setTab] = useState<GeneralTab>('time');

  return (
    <SettingsSection
      title="General"
      description={
        <>
          Time recording, work in progress and billing, rates, expenses and locale for the whole
          practice. The name, address, VAT number and bank details are in{' '}
          <Link
            to={modulePath(organization.slug, ORG_SEGMENTS.settings, 'practice')}
            className="font-medium text-brand-text underline-offset-2 hover:underline"
          >
            Practice Settings
          </Link>
          .
        </>
      }
    >
      {editable ? null : (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Badge tone="grey">Read only</Badge>
          Changing these settings needs permission to update the practice.
        </p>
      )}
      <Tabs label="General settings section" idBase="general-settings" items={TABS} value={tab} onChange={setTab} />
      {/* Every card stays mounted (only hidden), so switching tabs never loses an unsaved edit
          in another card — each card keeps its own independent form state and Save button. */}
      <div
        role="tabpanel"
        id="general-settings-panel-time"
        aria-labelledby="general-settings-tab-time"
        className={cn(tab !== 'time' && 'hidden')}
      >
        <TimeSettingsCard organization={organization} editable={editable} />
      </div>
      <div
        role="tabpanel"
        id="general-settings-panel-billing"
        aria-labelledby="general-settings-tab-billing"
        className={cn(tab !== 'billing' && 'hidden')}
      >
        <BillingSettingsCard organization={organization} editable={editable} />
      </div>
      <div
        role="tabpanel"
        id="general-settings-panel-rates"
        aria-labelledby="general-settings-tab-rates"
        className={cn(tab !== 'rates' && 'hidden')}
      >
        <RateModeCard organization={organization} editable={editable} />
      </div>
      <div
        role="tabpanel"
        id="general-settings-panel-expenses"
        aria-labelledby="general-settings-tab-expenses"
        className={cn(tab !== 'expenses' && 'hidden')}
      >
        <ExpenseSettingsCard organization={organization} editable={editable} />
      </div>
      <div
        role="tabpanel"
        id="general-settings-panel-locale"
        aria-labelledby="general-settings-tab-locale"
        className={cn(tab !== 'locale' && 'hidden')}
      >
        <LocaleSettingsCard organization={organization} editable={editable} />
      </div>
    </SettingsSection>
  );
}
