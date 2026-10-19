import type { SelectOption } from '@/components/ui';
import type { ActivityType, Service } from '@/features/team';

/**
 * The activity types an entry on a job may use: the active ones, limited to those of the job's
 * service when that service lists any. `keep` is the type the entry has now, offered even when it
 * is no longer allowed so an edit does not silently drop it.
 */
export function activityOptions(
  activities: ReadonlyArray<ActivityType> | undefined,
  services: ReadonlyArray<Service> | undefined,
  serviceId: string | null,
  keep: string | null,
): SelectOption[] {
  const service = serviceId ? services?.find((item) => item.id === serviceId) : undefined;
  const limited =
    service && service.activity_code_ids.length > 0 ? service.activity_code_ids : null;
  const allowed = (activities ?? []).filter(
    (activity) =>
      activity.id === keep ||
      (activity.is_active && (limited === null || limited.includes(activity.id))),
  );
  return [
    { value: '', label: 'No activity' },
    ...allowed.map((activity) => ({
      value: activity.id,
      label: activity.is_active ? activity.name : `${activity.name} (inactive)`,
    })),
  ];
}
