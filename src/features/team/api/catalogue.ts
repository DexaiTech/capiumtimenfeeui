import { useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type {
  ActivityTypeCreate,
  ActivityTypeUpdate,
  Service,
  ServiceCreate,
  ServiceUpdate,
} from '../types';
import { useTeamInvalidation } from './invalidation';
import { teamKeys } from './keys';
import { teamApi } from './teamApi';

/** Every service, active or not (the list is bounded). Readable by any member. */
export function useServices(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.services(organization.id),
    queryFn: ({ signal }) => teamApi.listServices(organization.id, signal),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/** Every activity type, active or not. Readable by any member. */
export function useActivityTypes(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.activityTypes(organization.id),
    queryFn: ({ signal }) => teamApi.listActivityTypes(organization.id, signal),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/** The practice's VAT codes, for the VAT select of a service or activity type. */
export function useVatCodes(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.vatCodes(organization.id),
    queryFn: ({ signal }) => teamApi.listVatCodes(organization.id, signal),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

export type SaveServiceVariables =
  | { mode: 'create'; body: ServiceCreate; activityTypeIds: string[] }
  | { mode: 'update'; serviceId: string; body: ServiceUpdate; activityTypeIds?: string[] };

/**
 * The service itself was saved, but replacing the activity types it is limited to failed. The
 * caller tells the person both, so they know the service exists and what is left to redo.
 */
export class ActivityLinkError extends Error {
  /** The service as saved; null when only the activity types were being changed. */
  saved: Service | null;
  /** Why the activity types were refused (usually an `ApiError`). */
  reason: unknown;

  constructor(saved: Service | null, reason: unknown) {
    super('The activity types of the service could not be saved');
    this.name = 'ActivityLinkError';
    this.saved = saved;
    this.reason = reason;
  }
}

/**
 * Creates or changes a service and, when given, replaces the activity types it is limited to
 * (a separate endpoint). The two calls run in order; a failure of the second leaves the first
 * saved and is reported as an `ActivityLinkError`.
 */
export function useSaveService() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: async (variables: SaveServiceVariables): Promise<Service | null> => {
      let saved: Service | null = null;
      let serviceId: string;
      if (variables.mode === 'create') {
        saved = await teamApi.createService(organization.id, variables.body);
        serviceId = saved.id;
        if (variables.activityTypeIds.length === 0) return saved;
      } else {
        serviceId = variables.serviceId;
        if (Object.keys(variables.body).length > 0) {
          saved = await teamApi.updateService(organization.id, serviceId, variables.body);
        }
      }
      if (variables.activityTypeIds) {
        try {
          await teamApi.setServiceActivityTypes(
            organization.id,
            serviceId,
            variables.activityTypeIds,
          );
        } catch (error) {
          throw new ActivityLinkError(saved, error);
        }
      }
      return saved;
    },
    onSettled: invalidate.catalogue,
  });
}

export function useDeleteService() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (serviceId: string) => teamApi.deleteService(organization.id, serviceId),
    onSettled: invalidate.catalogue,
  });
}

export function useSetServiceActive() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ serviceId, active }: { serviceId: string; active: boolean }) =>
      teamApi.setServiceActive(organization.id, serviceId, active),
    onSettled: invalidate.catalogue,
  });
}

export function useCreateActivityType() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: ActivityTypeCreate) => teamApi.createActivityType(organization.id, body),
    onSettled: invalidate.catalogue,
  });
}

export function useUpdateActivityType() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ activityId, body }: { activityId: string; body: ActivityTypeUpdate }) =>
      teamApi.updateActivityType(organization.id, activityId, body),
    onSettled: invalidate.catalogue,
  });
}

export function useDeleteActivityType() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (activityId: string) => teamApi.deleteActivityType(organization.id, activityId),
    onSettled: invalidate.catalogue,
  });
}

export function useSetActivityTypeActive() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ activityId, active }: { activityId: string; active: boolean }) =>
      teamApi.setActivityTypeActive(organization.id, activityId, active),
    onSettled: invalidate.catalogue,
  });
}
