import { CalendarX2, Pencil, Plus, Trash2, WalletCards } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageToolbar,
  useToast,
  type BadgeTone,
  type DataTableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { formatUkDate, todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useDeleteClientRate } from '../../api';
import type { ClientDetail, ClientRateRead } from '../../types';
import type { ClientAbilities } from '../abilities';
import { describeError, type Failure } from '../errors';
import {
  ClientRateDialog,
  RateEndDialog,
  type ClientRateTarget,
  type RateEndTarget,
} from './ClientRateDialogs';
import {
  canEndRate,
  rateAudience,
  rateStatus,
  RATE_STATUS_LABELS,
  type RateStatus,
} from './rateStatus';

export interface RatesCardProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

const STATUS_TONES: Record<RateStatus, BadgeTone> = {
  current: 'success',
  future: 'info',
  ended: 'neutral',
};

/** What to say when a rate that has been used cannot be deleted. */
const RATE_IN_USE_HINT = ' End-date it instead: the time already recorded keeps its rate.';

/** Charge-out rate overrides of this client: add, change the amount, end-date, delete. */
export function RatesCard({ client, abilities }: RatesCardProps) {
  const { organization } = useOrg();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ClientRateTarget | null>(null);
  const [ending, setEnding] = useState<RateEndTarget | null>(null);
  const [deleting, setDeleting] = useState<ClientRateRead | null>(null);
  const [refusal, setRefusal] = useState<Failure | null>(null);
  const remove = useDeleteClientRate();
  const currency = organization.currency;
  const today = todayInZone(organization.timezone);

  if (!abilities.seeRates) return null;
  const rates = [...(client.rates ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  const canManage = abilities.manageRates;

  const closeDelete = () => {
    setDeleting(null);
    setRefusal(null);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ clientId: client.id, rateId: deleting.id });
      toast({ tone: 'success', title: 'Rate deleted', description: rateAudience(deleting) });
      closeDelete();
    } catch (error) {
      const failure = describeError(error);
      setRefusal(
        failure.code === 'RATE_IN_USE'
          ? { ...failure, message: `${failure.message}${RATE_IN_USE_HINT}` }
          : failure,
      );
    }
  };

  const columns: DataTableColumn<ClientRateRead>[] = [
    {
      id: 'applies',
      header: 'Applies to',
      hideable: false,
      cell: (rate) => <span className="font-semibold text-text">{rateAudience(rate)}</span>,
    },
    {
      id: 'rate',
      header: 'Rate',
      align: 'end',
      cell: (rate) => `${formatMoney(rate.hourly_rate, currency)} / h`,
    },
    { id: 'from', header: 'From', cell: (rate) => formatUkDate(rate.effective_from) },
    {
      id: 'to',
      header: 'To',
      cell: (rate) =>
        rate.effective_to ? (
          formatUkDate(rate.effective_to)
        ) : (
          <span className="text-text-muted">No end date</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (rate) => {
        const status = rateStatus(rate, today);
        return (
          <Badge tone={STATUS_TONES[status]} size="sm">
            {RATE_STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
  ];

  return (
    <section aria-label="Rate overrides" className="flex flex-col gap-2">
      <DataTable
        caption={`Rate overrides of ${client.name}`}
        columns={columns}
        rows={rates}
        rowKey={(rate) => rate.id}
        toolbar={
          <PageToolbar
            start={
              <h2 className="px-2 text-sm font-semibold text-text">
                Rate overrides <span className="font-normal text-text-muted">{rates.length}</span>
              </h2>
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setEditing({ clientId: client.id, rate: null })}
                >
                  Add rate
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (rate) => (
                <span className="inline-flex items-center gap-1.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit rate of ${rateAudience(rate)}`}
                    onClick={() => setEditing({ clientId: client.id, rate })}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </Button>
                  {canEndRate(rate, today) ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`End-date rate of ${rateAudience(rate)}`}
                      onClick={() => setEnding({ rate })}
                    >
                      <CalendarX2 aria-hidden="true" className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete rate of ${rateAudience(rate)}`}
                    onClick={() => setDeleting(rate)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </span>
              )
            : undefined
        }
        empty={
          <EmptyState
            icon={<WalletCards className="size-6" />}
            title="No rate overrides"
            description="Time for this client is charged at each person's standard rate. Add an override to charge this client differently."
          />
        }
      />
      <ClientRateDialog target={editing} onClose={() => setEditing(null)} />
      <RateEndDialog target={ending} onClose={() => setEnding(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={closeDelete}
        onConfirm={() => void confirmDelete()}
        title="Delete rate"
        confirmLabel="Delete"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          Delete the {deleting ? formatMoney(deleting.hourly_rate, currency) : ''} an hour rate of{' '}
          {deleting ? rateAudience(deleting) : ''} for {client.name}?
        </p>
      </ConfirmDialog>
    </section>
  );
}
