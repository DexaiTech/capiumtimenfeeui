import { Skeleton, ErrorState } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { isApiError } from '@/services/api';
import { cn } from '@/utils/cn';

import type { ClientDetail, MemberRead } from '../../types';
import type { ClientOverview } from '../types';
import { ActivityTimeline } from './ActivityTimeline';
import { DetailPanels } from './DetailPanels';
import { KpiCards } from './KpiCards';
import { WipAgeingCard } from './WipAgeingCard';

export interface OverviewTabProps {
  client: ClientDetail;
  overview: {
    data: ClientOverview | undefined;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    isRefetching: boolean;
    refetch: () => unknown;
  };
  members: MemberRead[] | undefined;
}

/**
 * The first tab: the key figures and the WIP ageing from `GET /clients/{id}/overview`, the recent
 * activity, and the panels of what is known about the client. If the figures fail to load the
 * panels still show, with a retry where the figures would be.
 */
export function OverviewTab({ client, overview, members }: OverviewTabProps) {
  const { organization } = useOrg();
  const data = overview.data;

  return (
    <div className="flex flex-col gap-4">
      {overview.isPending ? (
        <div
          role="status"
          aria-label="Loading the key figures"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} shape="rect" className="h-24 w-full" />
          ))}
        </div>
      ) : data ? (
        <>
          <KpiCards clientId={client.id} overview={data} />
          <div className={cn('grid gap-4', data.wip && 'lg:grid-cols-2')}>
            {data.wip ? (
              <WipAgeingCard ageing={data.wip.ageing} currency={organization.currency} />
            ) : null}
            <ActivityTimeline events={data.recent_activity} />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <ErrorState
            title="Could not load the key figures"
            error={isApiError(overview.error) ? overview.error : null}
            onRetry={() => void overview.refetch()}
            retrying={overview.isRefetching}
            className="py-8"
          />
        </div>
      )}
      <DetailPanels client={client} currency={organization.currency} members={members} />
    </div>
  );
}
