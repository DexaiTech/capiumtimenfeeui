import { Building2, Info, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Badge, EmptyState, ErrorState, Input, Skeleton } from '@/components/ui';
import { useDebouncedValue } from '@/hooks';
import { isApiError } from '@/services/api';

import { useCentralSearch } from '../api';
import { centralAddress } from './format';
import type { CentralClient } from './types';

export interface CentralSearchProps {
  /** The action of one result: Enable, Link, "Open client". */
  renderAction: (client: CentralClient) => ReactNode;
  /** A line under a result, for what the action will do with it. */
  renderNote?: (client: CentralClient) => ReactNode;
}

/**
 * Searches the central client service (`GET /central-clients?q=`, 300 ms after typing stops) and
 * lists what it finds. While the service is down the API answers from the practice's cache and
 * says so (`stale`): a banner then warns that the data may be out of date; a 503 with nothing
 * cached is an error state with a retry.
 */
export function CentralSearch({ renderAction, renderNote }: CentralSearchProps) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 300);
  const search = useCentralSearch(q, true);
  const items = search.data?.items ?? [];
  const typing = text.trim() !== q;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        label="Search central clients"
        hideLabel
        leftIcon={<Search aria-hidden="true" className="size-4" />}
        placeholder="Search by name or company number"
        autoComplete="off"
        value={text}
        maxLength={200}
        onChange={(event) => setText(event.target.value)}
        data-autofocus
      />

      {search.data?.stale || search.data?.source === 'cache' ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-text"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          Central service unavailable: showing cached data
        </p>
      ) : null}

      {search.isError && !search.data ? (
        <ErrorState
          title="Central clients are unavailable"
          error={isApiError(search.error) ? search.error : null}
          onRetry={() => void search.refetch()}
          retrying={search.isRefetching}
          className="py-8"
        />
      ) : search.isPending ? (
        <div role="status" aria-label="Searching central clients" className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} shape="rect" className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title={q ? 'No central clients match' : 'No central clients yet'}
          description={
            q
              ? 'Try the start of the name or the company number.'
              : 'The central client service has nothing to enable.'
          }
          className="py-8"
        />
      ) : (
        <ul
          aria-label="Central clients"
          aria-busy={search.isFetching || typing}
          className="flex max-h-[50dvh] flex-col divide-y divide-row-border overflow-y-auto"
        >
          {items.map((client) => (
            <li
              key={client.central_id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-text uppercase">{client.name}</span>
                  <Badge tone={client.status === 'active' ? 'green' : 'grey'} size="sm">
                    {client.status === 'active' ? 'Active' : 'Archived centrally'}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted">
                  {client.company_number
                    ? `Company no. ${client.company_number}`
                    : 'No company number'}
                  {centralAddress(client) ? ` · ${centralAddress(client)}` : ''}
                </p>
                {renderNote?.(client)}
              </div>
              <div className="flex shrink-0 items-center gap-2">{renderAction(client)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
