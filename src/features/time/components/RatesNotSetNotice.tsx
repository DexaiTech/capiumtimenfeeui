import { Link } from 'react-router';

import { PERMISSIONS } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useOnboarding } from '@/features/settings';

import { Notice } from './Notice';

/**
 * Time is valued at the rate in force when it is saved, and a rate set later never rewrites it.
 * While the practice has no grade rates, say so where time is recorded, before it is worth £0.
 * Silent when the checklist cannot be read or the rates step is done or skipped.
 */
export function RatesNotSetNotice() {
  const { organization, can } = useOrg();
  const checklist = useOnboarding();
  const step = checklist.data?.steps.find((entry) => entry.key === 'grades_rates');
  if (step?.state !== 'todo') return null;
  const canSet = can(PERMISSIONS.rateManage);
  return (
    <Notice
      tone="warning"
      title="Rates are not set up yet"
      action={
        canSet ? (
          <Link
            to={modulePath(organization.slug, ORG_SEGMENTS.team, 'grades')}
            className="text-sm font-semibold text-brand-text hover:underline"
          >
            Set rates
          </Link>
        ) : undefined
      }
    >
      Time you record now is valued at £0, and a rate set later does not change it.{' '}
      {canSet
        ? 'Set the grade rates first.'
        : 'Ask your administrator to set the grade rates; time can be re-priced until it is billed.'}
    </Notice>
  );
}
