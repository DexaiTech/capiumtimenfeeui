import { Select } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { ClientPicker, JobPicker, useServices } from '@/features/team';

import { useMembers } from '../api';
import type { WipFilters } from '../types';

export type FilterField = 'client' | 'job' | 'partner' | 'manager' | 'service';

const ALL: ReadonlyArray<FilterField> = ['client', 'job', 'partner', 'manager', 'service'];

export interface WipFilterFieldsProps {
  value: WipFilters;
  /** The changes to write to the address: a cleared filter is null. */
  onChange: (changes: Record<string, string | null>) => void;
  fields?: ReadonlyArray<FilterField>;
}

/** The filter controls of a WIP view: client, job, partner, manager and service. */
export function WipFilterFields({ value, onChange, fields = ALL }: WipFilterFieldsProps) {
  const { can } = useOrg();
  const members = useMembers();
  const services = useServices({ enabled: fields.includes('service') });

  const people = [
    { value: '', label: 'Anyone' },
    ...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.full_name })),
  ];
  const serviceOptions = [
    { value: '', label: 'Any service' },
    ...(services.data ?? []).map((service) => ({ value: service.id, label: service.name })),
  ];

  return (
    <>
      {fields.includes('client') && can(PERMISSIONS.clientRead) ? (
        <ClientPicker
          label="Client"
          clearable
          value={value.client_id ?? null}
          onChange={(id) => onChange({ client_id: id, job_id: null })}
        />
      ) : null}
      {fields.includes('job') && can(PERMISSIONS.jobRead) ? (
        <JobPicker
          label="Job"
          clearable
          value={value.job_id ?? null}
          clientId={value.client_id ?? null}
          onChange={(job) => onChange({ job_id: job?.id ?? null })}
        />
      ) : null}
      {fields.includes('partner') ? (
        <Select
          label="Partner"
          options={people}
          value={value.partner_user_id ?? ''}
          onChange={(event) => onChange({ partner_user_id: event.target.value || null })}
        />
      ) : null}
      {fields.includes('manager') ? (
        <Select
          label="Manager"
          options={people}
          value={value.manager_user_id ?? ''}
          onChange={(event) => onChange({ manager_user_id: event.target.value || null })}
        />
      ) : null}
      {fields.includes('service') ? (
        <Select
          label="Service"
          options={serviceOptions}
          value={value.service_id ?? ''}
          onChange={(event) => onChange({ service_id: event.target.value || null })}
        />
      ) : null}
    </>
  );
}
