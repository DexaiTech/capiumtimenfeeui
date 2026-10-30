import { ArrowUpRight, Briefcase } from 'lucide-react';
import { Link } from 'react-router';

import { Card, EmptyState, Skeleton } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { JobPicker } from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { useJob } from '../api';
import { JobDetailsCard } from '../components/JobDetailsCard';
import { JobSummaryCards } from '../components/JobSummaryCards';
import { JobTimeAndBudget } from '../components/JobTimeAndBudget';
import { LoadError, PageShell } from '../components/PageShell';
import { JobStatusBadge } from '../components/StatusBadges';
import { TasksPanel } from '../components/TasksPanel';
import { isNotFound } from '../utils/errors';
import { jobLabel } from '../utils/format';

/** `/:orgSlug/jobs/details`: pick a job to see its tasks, time, budget and billing on one page. */
export default function JobDetailsPage() {
  useDocumentTitle('Job Details');
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();
  const jobId = params.get('job');
  const query = useJob(jobId ?? undefined);
  const job = query.data;

  let body;
  if (!jobId) {
    body = (
      <Card padding="none">
        <EmptyState
          icon={<Briefcase className="size-6" />}
          title="Pick a job"
          description="Search for a job by its number or name to see its figures, tasks and budget here."
        />
      </Card>
    );
  } else if (query.isPending) {
    body = (
      <Card>
        <Skeleton lines={4} />
      </Card>
    );
  } else if (!job) {
    body = isNotFound(query.error) ? (
      <Card padding="none">
        <EmptyState
          title="This job does not exist"
          description="It may have been deleted, or it belongs to another practice."
        />
      </Card>
    ) : (
      <LoadError
        title="Could not load the job"
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-text">{jobLabel(job)}</h2>
          <JobStatusBadge status={job.status} />
          <Link
            to={routes.org.job(organization.slug, job.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-text hover:underline"
          >
            Open the job page
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
        <JobSummaryCards job={job} currency={organization.currency} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <TasksPanel job={job} />
            <JobTimeAndBudget key={job.id} job={job} />
          </div>
          <JobDetailsCard job={job} />
        </div>
      </>
    );
  }

  return (
    <PageShell
      title="Job Details"
      description="Pick a job to see its tasks, time, budget and billing."
      actions={
        <div className="w-full sm:w-72">
          <JobPicker
            label="Job"
            hideLabel
            clearable
            value={jobId}
            onChange={(picked) => setParam({ job: picked?.id ?? null })}
          />
        </div>
      }
    >
      {body}
    </PageShell>
  );
}
