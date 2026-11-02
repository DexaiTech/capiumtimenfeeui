import { Info } from 'lucide-react';
import { Link } from 'react-router';

import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { approvalOn, type ApprovalArea } from '@/utils/approvals';
import { cn } from '@/utils/cn';

import { useOrg } from '../orgContext';

const TEXT: Record<Exclude<ApprovalArea, 'invoice'>, { title: string; detail: string }> = {
  timesheet: {
    title: 'Timesheet approval is switched off',
    detail: 'Nobody approves timesheets: submitting a week approves it at once.',
  },
  expense: {
    title: 'Expense approval is switched off',
    detail: 'Nobody approves expense claims: a claim is approved as soon as it is submitted.',
  },
  wip_adjustment: {
    title: 'WIP adjustment approval is switched off',
    detail: 'Nobody approves WIP adjustments: every write-on and write-off takes effect at once.',
  },
};

export interface ApprovalOffNoticeProps {
  area: Exclude<ApprovalArea, 'invoice'>;
  className?: string;
}

/**
 * On an approval screen whose flow the practice has switched off (General Settings): says so,
 * and that anything still listed was waiting from before (a locked period kept it from being
 * approved when the switch went off) and is decided as usual. Nothing while the flow is on.
 */
export function ApprovalOffNotice({ area, className }: ApprovalOffNoticeProps) {
  const { organization, can } = useOrg();
  if (approvalOn(organization, area)) return null;
  const text = TEXT[area];
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-soft px-3.5 py-2.5 text-sm text-text',
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold">{text.title}</p>
        <p className="text-text-muted">
          {text.detail} Anything still waiting here was waiting before and is decided as usual.{' '}
          {can(PERMISSIONS.organizationUpdate) ? (
            <Link
              to={routes.org.module(organization.slug, 'settings', 'general')}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Change it in General Settings
            </Link>
          ) : null}
        </p>
      </div>
    </div>
  );
}
