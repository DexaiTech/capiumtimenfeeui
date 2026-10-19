import { Link } from 'react-router';

import { Badge } from '@/components/ui';
import { ORG_SEGMENTS, modulePath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { BillingSettingsCard } from '../components/general/BillingSettingsCard';
import { ExpenseSettingsCard } from '../components/general/ExpenseSettingsCard';
import { LocaleSettingsCard } from '../components/general/LocaleSettingsCard';
import { RateModeCard } from '../components/general/RateModeCard';
import { TimeSettingsCard } from '../components/general/TimeSettingsCard';
import { SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/general`: how time, WIP, billing, rates and expenses behave across the
 * practice. Companion to Practice Settings (name, address, VAT and bank details), which edits
 * the same practice through the same endpoint; each card here saves only its own settings.
 */
export default function GeneralSettingsPage() {
  const { organization, can } = useOrg();
  useDocumentTitle('General settings');
  const editable = can(PERMISSIONS.organizationUpdate);

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
      <TimeSettingsCard organization={organization} editable={editable} />
      <BillingSettingsCard organization={organization} editable={editable} />
      <RateModeCard organization={organization} editable={editable} />
      <ExpenseSettingsCard organization={organization} editable={editable} />
      <LocaleSettingsCard organization={organization} editable={editable} />
    </SettingsSection>
  );
}
