import type { ClientOption, JobOption, PickerItem, StaffMember } from '../../types';

/** A staff member in a picker: the name, with the code and work email under it. */
export function staffItem(
  member: Pick<StaffMember, 'id' | 'full_name' | 'code' | 'email'>,
): PickerItem {
  return {
    id: member.id,
    label: member.full_name,
    detail: [member.code, member.email].filter(Boolean).join(' · '),
  };
}

/** A client in a picker: the name, with the code under it. */
export function clientItem(client: ClientOption): PickerItem {
  return { id: client.id, label: client.name, detail: client.code };
}

/** A job in a picker: the number and name, with the client under it. */
export function jobItem(job: JobOption): PickerItem {
  return { id: job.id, label: `${job.number} · ${job.name}`, detail: job.client_name };
}
