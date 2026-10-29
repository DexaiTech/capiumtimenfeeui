import { ArrowLeft, Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { JobTimeCard } from '@/features/time';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/services/api';

import { useChangeJobStatus, useDeleteJob, useJob, useSetJobAssignees } from '../api';
import { AssigneePicker } from '../components/AssigneePicker';
import { BudgetPanel } from '../components/BudgetPanel';
import { CopyJobDialog } from '../components/CopyJobDialog';
import { JobDetailsCard } from '../components/JobDetailsCard';
import { JobFormPanel } from '../components/JobFormPanel';
import { JobSummaryCards } from '../components/JobSummaryCards';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { JobStatusPicker } from '../components/StatusPickers';
import { TasksPanel } from '../components/TasksPanel';
import { BILLING_BASIS_LABEL, JOB_STATUS_META } from '../constants';
import type { JobStatus } from '../types';
import { describeFailure, dialogError, isNotFound } from '../utils/errors';
import { jobLabel } from '../utils/format';

type Dialog = 'edit' | 'copy' | 'delete';

/** What changing to one of these statuses means, asked before it is done. */
const CONFIRMED: Partial<Record<JobStatus, { title: string; body: string; confirm: string }>> = {
  closed: {
    title: 'Close this job?',
    body: 'A closed job takes no new time and its tasks cannot be changed until it is reopened.',
    confirm: 'Close job',
  },
  cancelled: {
    title: 'Cancel this job?',
    body: 'A cancelled job takes no new time and cannot be reopened.',
    confirm: 'Cancel job',
  },
};

/** `/:orgSlug/jobs/:jobId`: one job with its figures, tasks, budget and who works on it. */
export default function JobDetailPage() {
  const { jobId } = useParams();
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const query = useJob(jobId);
  const changeStatus = useChangeJobStatus();
  const setAssignees = useSetJobAssignees();
  const remove = useDeleteJob();

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, setPending] = useState<JobStatus | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const job = query.data;
  useDocumentTitle(job ? jobLabel(job) : 'Job');
  const back = (
    <Link
      to={routes.org.jobs(organization.slug)}
      className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-text-muted hover:text-text"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Job List
    </Link>
  );

  if (query.isPending) {
    return (
      <PageShell title="Job">
        {back}
        <Card>
          <Skeleton lines={3} />
        </Card>
      </PageShell>
    );
  }
  if (!job) {
    if (isNotFound(query.error)) {
      return (
        <PageShell title="Job">
          {back}
          <Card padding="none">
            <EmptyState
              title="This job does not exist"
              description="It may have been deleted, or it belongs to another practice."
            />
          </Card>
        </PageShell>
      );
    }
    if (isApiError(query.error) && query.error.status === 403) {
      return (
        <PageShell title="Job">
          {back}
          <NoAccess what="this job" />
        </PageShell>
      );
    }
    return (
      <PageShell title="Job">
        {back}
        <LoadError
          title="Could not load the job"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </PageShell>
    );
  }

  const canUpdate = can(PERMISSIONS.jobUpdate);

  const moveTo = (status: JobStatus) => {
    changeStatus.mutate(
      { jobId: job.id, status },
      {
        onSuccess: () => {
          toast({
            tone: 'success',
            title: 'Status changed',
            description: `${jobLabel(job)} is now ${JOB_STATUS_META[status].label.toLowerCase()}.`,
          });
          setPending(null);
        },
        onError: (error) => {
          if (pending) setRefusal(dialogError(error));
          else toast({ tone: 'error', ...describeFailure(error, 'Could not change the status') });
        },
      },
    );
  };

  const confirmDelete = () => {
    remove.mutate(job.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Job deleted', description: jobLabel(job) });
        void navigate(routes.org.jobs(organization.slug));
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const confirmation = pending ? CONFIRMED[pending] : undefined;

  return (
    <PageShell
      title={jobLabel(job)}
      description={`${job.client_name} · ${BILLING_BASIS_LABEL[job.billing_basis]}`}
      actions={
        <>
          {canUpdate ? (
            <Button
              variant="outline"
              onClick={() => setDialog('edit')}
              leftIcon={<Pencil aria-hidden="true" className="size-4" />}
            >
              Edit
            </Button>
          ) : null}
          {can(PERMISSIONS.jobCreate) ? (
            <Button
              variant="outline"
              onClick={() => setDialog('copy')}
              leftIcon={<Copy aria-hidden="true" className="size-4" />}
            >
              Copy
            </Button>
          ) : null}
          {can(PERMISSIONS.jobDelete) ? (
            <Button
              variant="outline"
              onClick={() => {
                setRefusal(null);
                setDialog('delete');
              }}
              leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
            >
              Delete
            </Button>
          ) : null}
        </>
      }
    >
      <JobFormPanel
        open={dialog === 'edit'}
        onClose={() => setDialog(null)}
        job={job}
        onSaved={() => setDialog(null)}
      />
      <div className="flex flex-wrap items-center gap-4">
        {back}
        <JobStatusPicker
          status={job.status}
          label={`Change the status of ${jobLabel(job)}`}
          canChange={canUpdate}
          onChoose={(status) => {
            if (CONFIRMED[status]) {
              setRefusal(null);
              setPending(status);
            } else {
              moveTo(status);
            }
          }}
        />
      </div>
      <JobSummaryCards job={job} currency={organization.currency} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <TasksPanel job={job} />
          <JobTimeCard jobId={job.id} jobNumber={job.number} />
          <BudgetPanel job={job} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <JobDetailsCard job={job} />
          <Card padding="none">
            <CardHeader title="Assigned to" description="The people who work on this job." />
            <div className="px-4 py-3">
              <AssigneePicker
                label={`Assignees of ${job.number}`}
                value={job.assignee_user_ids}
                disabled={!canUpdate}
                onChange={(userIds) =>
                  setAssignees.mutate(
                    { jobId: job.id, userIds },
                    {
                      onError: (error) =>
                        toast({
                          tone: 'error',
                          ...describeFailure(error, 'Could not change the assignees'),
                        }),
                    },
                  )
                }
              />
            </div>
          </Card>
        </div>
      </div>

      <CopyJobDialog
        open={dialog === 'copy'}
        onClose={() => setDialog(null)}
        job={job}
        onCopied={(created) => {
          setDialog(null);
          void navigate(routes.org.job(organization.slug, created.id));
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={confirmDelete}
        title="Delete this job?"
        confirmLabel="Delete job"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          {jobLabel(job)} and its tasks will be removed. A job with time, expenses or invoices
          against it cannot be deleted: complete or cancel it instead.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmation !== undefined}
        onClose={() => setPending(null)}
        onConfirm={() => pending && moveTo(pending)}
        title={confirmation?.title ?? ''}
        confirmLabel={confirmation?.confirm ?? 'Confirm'}
        loading={changeStatus.isPending}
        error={refusal}
      >
        <p>{confirmation?.body ?? ''}</p>
      </ConfirmDialog>
    </PageShell>
  );
}
