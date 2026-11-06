import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';

import { ReportScreen } from '../components/ReportScreen';
import { staffCostJobsReport, staffCostReport } from '../definitions/staffCost';

/**
 * /:orgSlug/reports/staff-cost: what each person's time cost, standard and overtime. With
 * `?group=job&user=…` (a row's drill) it lists the jobs that person worked overtime on.
 */
export default function StaffCostReportPage() {
  const { organization } = useOrg();
  const [params] = useSearchParams();
  if (params.get('group') !== 'job' || !params.get('user')) {
    return <ReportScreen config={staffCostReport} />;
  }

  const back = new URLSearchParams(params);
  back.delete('group');
  back.delete('user');
  const search = back.toString();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Link
        to={`${routes.org.module(organization.slug, 'reports', 'staff-cost')}${search ? `?${search}` : ''}`}
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-text hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All staff
      </Link>
      <ReportScreen config={staffCostJobsReport} />
    </div>
  );
}
