import { useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type {
  ActivityTypeCreate,
  ActivityTypeUpdate,
  Service,
  ServiceCreate,
  ServiceUpdate,
  TaskTemplateInput,
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

/**
 * The default tasks of a service, in order. Nothing is fetched without a service (or when
 * `enabled` is false). Readable with the permission the other service endpoints need.
 */
export function useServiceTaskTemplates(
  serviceId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.serviceTaskTemplates(organization.id, serviceId ?? ''),
    queryFn: ({ signal }) =>
      teamApi.listServiceTaskTemplates(organization.id, serviceId ?? '', signal),
    enabled: Boolean(serviceId) && (options.enabled ?? true),
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
  | {
      mode: 'create';
      body: ServiceCreate;
      activityTypeIds: string[];
      templates?: TaskTemplateInput[];
    }
  | {
      mode: 'update';
      serviceId: string;
      body: ServiceUpdate;
      activityTypeIds?: string[];
      /** The whole new list of default tasks; left out to keep the saved one. */
      templates?: TaskTemplateInput[];
    };

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
 * The service itself (and its activity types) were saved, but replacing its default tasks failed.
 * The caller tells the person both, so they know the service exists and what is left to redo.
 */
export class TaskTemplateSaveError extends Error {
  /** The service as saved; null when only the default tasks were being changed. */
  saved: Service | null;
  /** Why the default tasks were refused (usually an `ApiError`). */
  reason: unknown;

  constructor(saved: Service | null, reason: unknown) {
    super('The default tasks of the service could not be saved');
    this.name = 'TaskTemplateSaveError';
    this.saved = saved;
    this.reason = reason;
  }
}

/**
 * Creates or changes a service and, when given, replaces the activity types it is limited to and
 * its default tasks (separate endpoints). The calls run in order; a failure of a later one leaves
 * the earlier ones saved and is reported as an `ActivityLinkError` or a `TaskTemplateSaveError`.
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
      } else {
        serviceId = variables.serviceId;
        if (Object.keys(variables.body).length > 0) {
          saved = await teamApi.updateService(organization.id, serviceId, variables.body);
        }
      }
      const activityTypeIds =
        variables.mode === 'create' && variables.activityTypeIds.length === 0
          ? undefined
          : variables.activityTypeIds;
      if (activityTypeIds) {
        try {
          await teamApi.setServiceActivityTypes(organization.id, serviceId, activityTypeIds);
        } catch (error) {
          throw new ActivityLinkError(saved, error);
        }
      }
      if (variables.templates) {
        try {
          await teamApi.setServiceTaskTemplates(organization.id, serviceId, variables.templates);
        } catch (error) {
          throw new TaskTemplateSaveError(saved, error);
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
