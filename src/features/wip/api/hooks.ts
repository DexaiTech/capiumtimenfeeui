import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';

import type {
  AdjustmentFilters,
  AdjustmentInput,
  ExportFormat,
  HistoricFilters,
  HistoricItemFilters,
  ItemFilters,
  LedgerFilters,
  SummaryFilters,
  TransferFilters,
  TransferInput,
  WipGroupRow,
  WipGroupTotals,
  WipSummary,
  WriteOffFilters,
  WriteOffInput,
} from '../types';
import { useWipInvalidation } from './invalidation';
import { wipKeys } from './keys';
import { fetchEverything, nextCursor, type ObjectPage } from './pages';
import { wipApi } from './wipApi';

interface QueryOptions {
  enabled?: boolean;
}

/* ----------------------------------- Reads ----------------------------------- */

/** WIP by client, job, partner, manager or service: previous rows stay while a filter loads. */
export function useWipSummary(filters: SummaryFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: wipKeys.summary(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      wipApi.summary(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** The rows of every page loaded so far. */
export function summaryRows(data: InfiniteData<ObjectPage<WipSummary>> | undefined): WipGroupRow[] {
  return data?.pages.flatMap((page) => page.data.rows) ?? [];
}

/** The totals over every row the filters select (the same on every page). */
export function summaryTotals(
  data: InfiniteData<ObjectPage<WipSummary>> | undefined,
): WipGroupTotals | null {
  return data?.pages[0]?.data.totals ?? null;
}

/** The unbilled items behind the figures. */
export function useWipItems(filters: ItemFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: wipKeys.items(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      wipApi.items(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useLedger(filters: LedgerFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: wipKeys.ledger(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      wipApi.ledger(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** The write-offs made from the items of the WIP, newest first. */
export function useWriteOffs(filters: WriteOffFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: wipKeys.writeOffs(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      wipApi.listWriteOffs(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useAdjustments(filters: AdjustmentFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: wipKeys.adjustments(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      wipApi.listAdjustments(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** How many adjustments are in each status, and what waits for approval. */
export function useAdjustmentCounts() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: wipKeys.adjustmentCounts(organization.id),
    queryFn: ({ signal }) => wipApi.adjustmentCounts(organization.id, signal),
  });
}

export function useTransfers(filters: TransferFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: wipKeys.transfers(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      wipApi.listTransfers(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** WIP as at a day (`report.financial`): a past day is frozen the first time it is read. */
export function useHistoricReport(filters: HistoricFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: wipKeys.historic(organization.id, filters),
    queryFn: ({ signal }) => wipApi.historic(organization.id, filters, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** The items behind a row of the historic report. */
export function useHistoricItems(filters: HistoricItemFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: wipKeys.historicItems(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      wipApi.historicItems(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: options.enabled ?? true,
  });
}

/** Every active member (the pickers and the names of partners, managers and people). */
export function useMembers() {
  const { organization, can } = useOrg();
  return useQuery({
    queryKey: wipKeys.members(organization.id),
    queryFn: ({ signal }) =>
      fetchEverything((cursor) => wipApi.listMembers(organization.id, cursor, signal)),
    enabled: can(PERMISSIONS.memberRead),
    staleTime: 5 * 60_000,
  });
}

/** A name for a user id, null while the people load or when the person is not an active member. */
export function useMemberNames() {
  const members = useMembers();
  return useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.user_id, member.full_name]));
    return (userId: string | null | undefined) => (userId ? (names.get(userId) ?? null) : null);
  }, [members.data]);
}

/* --------------------------------- Mutations --------------------------------- */

export function useCreateAdjustment() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: (body: AdjustmentInput) => wipApi.createAdjustment(organization.id, body),
    onSettled: invalidate.changed,
  });
}

export function useApproveAdjustment() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: ({ adjustmentId, note }: { adjustmentId: string; note?: string }) =>
      wipApi.approveAdjustment(organization.id, adjustmentId, note),
    onSettled: invalidate.changed,
  });
}

export function useRejectAdjustment() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: ({ adjustmentId, reason }: { adjustmentId: string; reason: string }) =>
      wipApi.rejectAdjustment(organization.id, adjustmentId, reason),
    onSettled: invalidate.changed,
  });
}

export function useReverseAdjustment() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: ({ adjustmentId, reason }: { adjustmentId: string; reason: string }) =>
      wipApi.reverseAdjustment(organization.id, adjustmentId, reason),
    onSettled: invalidate.changed,
  });
}

export function useCreateTransfer() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: (body: TransferInput) => wipApi.createTransfer(organization.id, body),
    onSettled: invalidate.changed,
  });
}

export function useReverseTransfer() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: ({ transferId, reason }: { transferId: string; reason: string }) =>
      wipApi.reverseTransfer(organization.id, transferId, reason),
    onSettled: invalidate.changed,
  });
}

export function useCreateWriteOff() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: (body: WriteOffInput) => wipApi.createWriteOff(organization.id, body),
    onSettled: invalidate.changed,
  });
}

export function useReverseWriteOff() {
  const { organization } = useOrg();
  const invalidate = useWipInvalidation();
  return useMutation({
    mutationFn: (writeOffId: string) => wipApi.reverseWriteOff(organization.id, writeOffId),
    onSettled: invalidate.changed,
  });
}

/** The historic report as a file; the caller offers the blob as a download. */
export function useExportHistoric() {
  const { organization } = useOrg();
  return useMutation({
    mutationFn: ({ filters, format }: { filters: HistoricFilters; format: ExportFormat }) =>
      wipApi.exportHistoric(organization.id, filters, format),
  });
}
