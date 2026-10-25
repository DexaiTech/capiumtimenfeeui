import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { PeriodLockView } from '../components/periodLock/PeriodLockView';
import { NoAccess, SettingsSection } from '../components/SettingsSection';

/**
 * `/:orgSlug/settings/period-lock`: lock time, expenses and WIP up to a day, and reopen periods.
 * `period_lock.read` shows it; `period_lock.manage` locks and `period_lock.reopen` reopens.
 */
export default function PeriodLockPage() {
  const { can } = useOrg();
  useDocumentTitle('Period lock');
  return (
    <SettingsSection
      title="Lock Past Periods"
      description="Lock time, expenses and WIP up to a date, and reopen periods."
    >
      {can(P.periodLockRead) ? <PeriodLockView /> : <NoAccess what="the period lock" />}
    </SettingsSection>
  );
}
