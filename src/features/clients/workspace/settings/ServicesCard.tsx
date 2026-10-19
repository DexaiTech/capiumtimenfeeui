import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageToolbar,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useDeleteEngagement } from '../../api';
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

/** The services the client takes (its engagements): add, edit, remove. */
export function ServicesCard({ client, abilities }: ServicesCardProps) {
  const { organization } = useOrg();
  const { toast } = useToast();
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
        <Badge tone={engagement.is_active ? 'success' : 'neutral'} size="sm">
          {engagement.is_active ? 'Active' : 'Inactive'}
        </Badge>
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
