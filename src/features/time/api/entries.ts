import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type {
  CopyEntryRequest,
  CopyWeekRequest,
  TimeCorrection,
  TimeEntryCreate,
  TimeEntryFilters,
  TimeEntryUpdate,
} from '../types';
import { useTimeInvalidation } from './invalidation';
import { timeKeys } from './keys';
import { nextCursor } from './pages';
import { timeApi } from './timeApi';

interface Enabled {
  enabled?: boolean;
}

/** A person's week as a grid with targets and missing days (`weekOf` is any day of it). */
export function useWeek(userId: string, weekOf: string, { enabled = true }: Enabled = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.week(organization.id, userId, weekOf),
    queryFn: ({ signal }) => timeApi.getWeek(organization.id, userId, weekOf, signal),
    enabled,
  });
}

/** Every entry of a person between two dates (a week): the grid's cells are made of them. */
export function useRangeEntries(
  userId: string,
  from: string,
  to: string,
  { enabled = true }: Enabled = {},
) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.weekEntries(organization.id, userId, from, to),
    queryFn: ({ signal }) => timeApi.listEntriesInRange(organization.id, userId, from, to, signal),
    enabled,
  });
}

export function useDay(userId: string, date: string, { enabled = true }: Enabled = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.day(organization.id, userId, date),
    queryFn: ({ signal }) => timeApi.getDay(organization.id, userId, date, signal),
    enabled,
  });
}

export function useCalendar(
  userId: string,
  from: string,
  to: string,
  { enabled = true }: Enabled = {},
) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.calendar(organization.id, userId, from, to),
    queryFn: ({ signal }) => timeApi.getCalendar(organization.id, userId, from, to, signal),
    enabled,
  });
}

/** The Time Entries list: newest first, with the cursor. */
export function useTimeEntryList(filters: TimeEntryFilters, { enabled = true }: Enabled = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: timeKeys.entryList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      timeApi.listEntries(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** The corrections of one entry, newest first. */
export function useEntryHistory(entryId: string | null) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: timeKeys.history(organization.id, entryId ?? ''),
    queryFn: ({ pageParam, signal }) =>
      timeApi.listHistory(organization.id, entryId ?? '', { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: entryId !== null,
  });
}

export function useCreateEntry() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (body: TimeEntryCreate) => timeApi.createEntry(organization.id, body),
    onSettled: invalidate.entries,
  });
}

export function useUpdateEntry() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: ({ entryId, body }: { entryId: string; body: TimeEntryUpdate }) =>
      timeApi.updateEntry(organization.id, entryId, body),
    onSettled: invalidate.entries,
  });
}

export function useDeleteEntry() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (entryId: string) => timeApi.deleteEntry(organization.id, entryId),
    onSettled: invalidate.entries,
  });
}

export function useCopyWeek() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (body: CopyWeekRequest) => timeApi.copyWeek(organization.id, body),
    onSettled: invalidate.entries,
  });
}

export function useCopyEntry() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: ({ entryId, body }: { entryId: string; body: CopyEntryRequest }) =>
      timeApi.copyEntry(organization.id, entryId, body),
    onSettled: invalidate.entries,
  });
}

export function useCorrectEntry() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: ({ entryId, body }: { entryId: string; body: TimeCorrection }) =>
      timeApi.correctEntry(organization.id, entryId, body),
    onSettled: invalidate.entries,
  });
}
