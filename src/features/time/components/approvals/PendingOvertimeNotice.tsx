import { Link } from 'react-router';

import { buttonClasses } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

import { useOvertime } from '../../api';
import { Notice } from '../Notice';

/**
 * Overtime waiting for a decision (APT81), for screens that approve timesheets without showing
 * their entries (Pending Approvals): approving a sheet leaves its overtime pending, which is
 * decided entry by entry on Timesheet Approvals. Nothing shows while overtime is off.
 */
export function PendingOvertimeNotice() {
  const { organization, can } = useOrg();
  const shown = organization.overtime_enabled && can(PERMISSIONS.timesheetApprove);
  const pending = useOvertime({ status: 'pending' }, { enabled: shown });
  const count = pending.data?.length ?? 0;
  if (!shown || count === 0) return null;
  return (
    <Notice
      tone="warning"
      title={`${count} overtime ${count === 1 ? 'entry is' : 'entries are'} waiting for a decision`}
      action={
        <Link
          to={routes.org.module(organization.slug, 'time', 'approvals')}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          Review overtime
        </Link>
      }
    >
      Approving a timesheet leaves its overtime pending: approve or reject it on Timesheet
      Approvals.
    </Notice>
  );
}
