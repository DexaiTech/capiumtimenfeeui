import { queryKeys } from '@/constants/queryKeys';

import type {
  AdjustmentFilters,
  HistoricFilters,
  HistoricItemFilters,
  ItemFilters,
  LedgerFilters,
  SummaryFilters,
  TransferFilters,
  WriteOffFilters,
} from '../types';

/**
 * Keys of the WIP data, all under `['org', organizationId, 'wip', …]`: the prefix the time,
 * expense and team features already refresh when a change moves the figures.
 */
export const wipKeys = {
  all: (organizationId: string) => queryKeys.org.wip(organizationId),
  summary: (organizationId: string, filters: SummaryFilters) =>
    [...queryKeys.org.wip(organizationId), 'summary', filters] as const,
  items: (organizationId: string, filters: ItemFilters) =>
    [...queryKeys.org.wip(organizationId), 'items', filters] as const,
  adjustments: (organizationId: string, filters: AdjustmentFilters) =>
    [...queryKeys.org.wip(organizationId), 'adjustments', filters] as const,
  adjustmentCounts: (organizationId: string) =>
    [...queryKeys.org.wip(organizationId), 'adjustment-counts'] as const,
  transfers: (organizationId: string, filters: TransferFilters) =>
    [...queryKeys.org.wip(organizationId), 'transfers', filters] as const,
  ledger: (organizationId: string, filters: LedgerFilters) =>
    [...queryKeys.org.wip(organizationId), 'ledger', filters] as const,
  writeOffs: (organizationId: string, filters: WriteOffFilters) =>
    [...queryKeys.org.wip(organizationId), 'write-offs', filters] as const,
  historic: (organizationId: string, filters: HistoricFilters) =>
    [...queryKeys.org.wip(organizationId), 'historic', filters] as const,
  historicItems: (organizationId: string, filters: HistoricItemFilters) =>
    [...queryKeys.org.wip(organizationId), 'historic-items', filters] as const,
  /** The active people the screens name (a staff change refreshes it with the other members). */
  members: (organizationId: string) =>
    [...queryKeys.org.members(organizationId), 'wip-directory'] as const,
};
