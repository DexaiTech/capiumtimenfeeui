import { Briefcase, History, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Modal,
  Spinner,
  PageToolbar,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { PERMISSIONS as P } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useCreateEngagementJob, useDeleteEngagement, useEngagementJobRuns } from '../../api';
import { EngagementFormDialog, type EngagementTarget } from '../../components/EngagementFormDialog';
import { FREQUENCY_LABELS, labelOf } from '../../constants';
import type { ClientDetail, ClientServiceRead } from '../../types';
import type { ClientAbilities } from '../abilities';
import { describeError, type Failure } from '../errors';

export interface ServicesCardProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

const BASIS_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  fixed: 'Fixed fee',
  non_billable: 'Non-billable',
};

/** The jobs an engagement created, newest first; fetched only while the dialog is open. */
function JobRunsDialog({
  clientId,
  engagement,
  slug,
  onClose,
}: {
  clientId: string;
  engagement: ClientServiceRead | null;
  slug: string;
  onClose: () => void;
}) {
  const runs = useEngagementJobRuns(clientId, engagement?.id ?? '', engagement !== null);
  return (
    <Modal
      open={engagement !== null}
      onClose={onClose}
      title={`Created jobs${engagement ? `: ${engagement.service_name}` : ''}`}
    >
      {runs.isPending ? (
        <Spinner label="Loading the created jobs" />
      ) : runs.isError ? (
        <p role="alert" className="text-sm text-danger">
          {describeError(runs.error).message}
        </p>
      ) : runs.data.length === 0 ? (
        <p className="text-sm text-text-muted">No job has been created for this service yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {runs.data.map((run) => (
            <li
              key={`${run.period_start}-${run.created_at}`}
              className="flex flex-col gap-0.5 py-2"
            >
              <span className="font-medium text-text">
                {formatUkDate(run.period_start)}
                {run.period_end ? ` to ${formatUkDate(run.period_end)}` : ''}
              </span>
              {run.status === 'failed' ? (
                <span className="text-danger">Failed: {run.error ?? 'No reason given'}</span>
              ) : run.job ? (
                <Link
                  className="text-primary hover:underline"
                  to={routes.org.job(slug, run.job.id)}
                >
                  {run.job.number} {run.job.name}
                </Link>
              ) : (
                <span className="text-text-muted">Job deleted</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** The services the client takes (its engagements): add, edit, remove, create their jobs. */
export function ServicesCard({ client, abilities }: ServicesCardProps) {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const createJob = useCreateEngagementJob();
  const [viewingRuns, setViewingRuns] = useState<ClientServiceRead | null>(null);
  const canCreateJob = abilities.edit && can(P.jobCreate);

  const createNow = async (engagement: ClientServiceRead) => {
    try {
      const created = await createJob.mutateAsync({
        clientId: client.id,
        engagementId: engagement.id,
      });
      toast({
        tone: 'success',
        title: `Job ${created.job.number} created`,
        description: engagement.service_name,
        action: {
          label: 'Open job',
          onClick: () => void navigate(routes.org.job(organization.slug, created.job.id)),
        },
      });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'The job was not created',
        description: describeError(error).message,
      });
    }
  };
  const [target, setTarget] = useState<EngagementTarget | null>(null);
  const [removing, setRemoving] = useState<ClientServiceRead | null>(null);
  const [refusal, setRefusal] = useState<Failure | null>(null);
  const remove = useDeleteEngagement();
  const canEdit = abilities.edit;
  const currency = organization.currency;
  const taken = client.engagements.map((engagement) => engagement.service_id);

  const openAdd = () =>
    setTarget({ clientId: client.id, engagement: null, takenServiceIds: taken });
  const closeRemove = () => {
    setRemoving(null);
    setRefusal(null);
  };
  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await remove.mutateAsync({ clientId: client.id, engagementId: removing.id });
      toast({ tone: 'success', title: 'Service removed', description: removing.service_name });
      closeRemove();
    } catch (error) {
      setRefusal(describeError(error));
    }
  };

  const columns: DataTableColumn<ClientServiceRead>[] = [
    {
      id: 'service',
      header: 'Service',
      hideable: false,
      cell: (engagement) => (
        <span className="font-semibold text-text">
          {engagement.service_name}{' '}
          <span className="font-normal text-text-muted">({engagement.service_code})</span>
        </span>
      ),
    },
    {
      id: 'billing',
      header: 'Billing',
      cell: (engagement) => BASIS_LABELS[engagement.billing_basis] ?? engagement.billing_basis,
    },
    {
      id: 'fee',
      header: 'Agreed fee',
      align: 'end',
      cell: (engagement) =>
        engagement.fee === null ? (
          <span className="text-text-muted">Service default</span>
        ) : (
          formatMoney(engagement.fee, currency)
        ),
    },
    {
      id: 'effective',
      header: 'Effective fee',
      align: 'end',
      cell: (engagement) =>
        engagement.effective_fee === null ? '—' : formatMoney(engagement.effective_fee, currency),
    },
    {
      id: 'frequency',
      header: 'Frequency',
      cell: (engagement) => labelOf(FREQUENCY_LABELS, engagement.frequency),
    },
    {
      id: 'start',
      header: 'Start',
      cell: (engagement) => formatUkDate(engagement.start_date) || '—',
    },
    {
      id: 'end',
      header: 'End',
      cell: (engagement) => formatUkDate(engagement.end_date) || '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (engagement) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Badge tone={engagement.is_active ? 'success' : 'neutral'} size="sm">
            {engagement.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {engagement.auto_create_jobs ? (
            <Badge tone="info" size="sm">
              Auto jobs
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'jobs',
      header: 'Jobs',
      cell: (engagement) => (
        <span className="flex flex-col items-start gap-1">
          {engagement.next_job_period ? (
            <span className="text-xs text-text-muted">
              Next job: {formatUkDate(engagement.next_job_period.period_start)}, created on{' '}
              {formatUkDate(engagement.next_job_period.create_on)}
            </span>
          ) : null}
          <span className="inline-flex flex-wrap gap-1">
            {canCreateJob && engagement.auto_create_jobs ? (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Play aria-hidden="true" className="size-4" />}
                loading={createJob.isPending && createJob.variables?.engagementId === engagement.id}
                aria-label={`Create this period's job now for ${engagement.service_name}`}
                onClick={() => void createNow(engagement)}
              >
                Create this period&apos;s job now
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<History aria-hidden="true" className="size-4" />}
              aria-label={`Created jobs of ${engagement.service_name}`}
              onClick={() => setViewingRuns(engagement)}
            >
              Created jobs
            </Button>
          </span>
        </span>
      ),
    },
  ];

  return (
    <section aria-label="Services" className="flex flex-col gap-2">
      <DataTable
        caption={`Services of ${client.name}`}
        columns={columns}
        rows={client.engagements}
        rowKey={(engagement) => engagement.id}
        toolbar={
          <PageToolbar
            start={
              <h2 className="px-2 text-sm font-semibold text-text">
                Services{' '}
                <span className="font-normal text-text-muted">{client.engagements.length}</span>
              </h2>
            }
            primaryAction={
              canEdit ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={openAdd}
                >
                  Add service
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canEdit
            ? (engagement) => (
                <span className="inline-flex items-center gap-1.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${engagement.service_name}`}
                    onClick={() =>
                      setTarget({ clientId: client.id, engagement, takenServiceIds: taken })
                    }
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${engagement.service_name}`}
                    onClick={() => setRemoving(engagement)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </span>
              )
            : undefined
        }
        empty={
          <EmptyState
            icon={<Briefcase className="size-6" />}
            title="This client takes no services yet"
            description="The services decide the default fee and the billing basis of the work recorded for the client."
          />
        }
      />
      <JobRunsDialog
        clientId={client.id}
        engagement={viewingRuns}
        slug={organization.slug}
        onClose={() => setViewingRuns(null)}
      />
      <EngagementFormDialog target={target} onClose={() => setTarget(null)} />
      <ConfirmDialog
        open={removing !== null}
        onClose={closeRemove}
        onConfirm={() => void confirmRemove()}
        title="Remove service"
        confirmLabel="Remove"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          Stop recording that {client.name} takes {removing?.service_name}?
        </p>
      </ConfirmDialog>
    </section>
  );
}
