import { useOrg } from '@/features/organizations';
import {
  ClientPicker,
  JobPicker,
  StaffPicker,
  useActivityTypes,
  useGradeOptions,
  useServices,
} from '@/features/team';
import { PERMISSIONS as P } from '@/constants/permissions';
import { Select } from '@/components/ui';

import type { FilterKey } from '../config';

const METHODS = [
  { value: '', label: 'Any method' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'direct_debit', label: 'Direct debit' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: '', label: 'Any state' },
  { value: 'none', label: 'Nothing started' },
  { value: 'open', label: 'Open, not submitted' },
  { value: 'rejected', label: 'Returned' },
];

const APPROVALS = [
  { value: '', label: 'Any status' },
  { value: 'pending', label: 'Pending (unapproved)' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const OVERTIME_TYPES = [
  { value: '', label: 'Any overtime' },
  { value: 'allocated', label: 'Allocated (on a client’s job)' },
  { value: 'unallocated', label: 'Unallocated (internal work)' },
];

function GradeFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const grades = useGradeOptions();
  return (
    <Select
      label="Grade"
      options={[
        { value: '', label: 'Any grade' },
        ...(grades.data ?? []).map((grade) => ({ value: grade.id, label: grade.name })),
      ]}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ServiceFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const services = useServices();
  return (
    <Select
      label="Service"
      options={[
        { value: '', label: 'Any service' },
        ...(services.data ?? []).map((service) => ({ value: service.id, label: service.name })),
      ]}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ActivityFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const activities = useActivityTypes();
  return (
    <Select
      label="Activity"
      options={[
        { value: '', label: 'Any activity' },
        ...(activities.data ?? []).map((activity) => ({
          value: activity.id,
          label: activity.name,
        })),
      ]}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export interface ReportFiltersProps {
  filters: ReadonlyArray<FilterKey>;
  personLabel?: string;
  /** What each filter is set to ('' when it is not). */
  values: Readonly<Record<FilterKey, string>>;
  /** Sets search params: null removes one. */
  onChange: (patch: Record<string, string | null>) => void;
}

/** The controls of the filters a report offers (the person pickers need the right to see people). */
export function ReportFilters({ filters, personLabel, values, onChange }: ReportFiltersProps) {
  const { can } = useOrg();
  const canPickPeople = can(P.memberRead);
  const has = (key: FilterKey) => filters.includes(key);

  return (
    <>
      {has('user') && canPickPeople ? (
        <StaffPicker
          label={personLabel ?? 'Person'}
          value={values.user || null}
          includeLeft
          placeholder="Everyone"
          onChange={(id) => onChange({ user: id })}
        />
      ) : null}
      {has('partner') && canPickPeople ? (
        <StaffPicker
          label="Partner"
          value={values.partner || null}
          placeholder="Any partner"
          onChange={(id) => onChange({ partner: id })}
        />
      ) : null}
      {has('manager') && canPickPeople ? (
        <StaffPicker
          label="Manager"
          value={values.manager || null}
          placeholder="Any manager"
          onChange={(id) => onChange({ manager: id })}
        />
      ) : null}
      {has('grade') && canPickPeople ? (
        <GradeFilter value={values.grade} onChange={(id) => onChange({ grade: id })} />
      ) : null}
      {has('client') && can(P.clientRead) ? (
        <ClientPicker
          label="Client"
          value={values.client || null}
          placeholder="Any client"
          onChange={(id) => onChange({ client: id, job: null })}
        />
      ) : null}
      {has('job') && can(P.jobRead) ? (
        <JobPicker
          label="Job"
          value={values.job || null}
          clientId={values.client || null}
          placeholder="Any job"
          onChange={(job) => onChange({ job: job?.id ?? null })}
        />
      ) : null}
      {has('service') ? (
        <ServiceFilter value={values.service} onChange={(id) => onChange({ service: id })} />
      ) : null}
      {has('activity') ? (
        <ActivityFilter value={values.activity} onChange={(id) => onChange({ activity: id })} />
      ) : null}
      {has('method') ? (
        <Select
          label="Method"
          options={METHODS}
          value={values.method}
          onChange={(event) => onChange({ method: event.target.value })}
        />
      ) : null}
      {has('status') ? (
        <Select
          label="Timesheet state"
          options={STATUSES}
          value={values.status}
          onChange={(event) => onChange({ status: event.target.value })}
        />
      ) : null}
      {has('approval') ? (
        <Select
          label="Approval status"
          options={APPROVALS}
          value={values.approval}
          onChange={(event) => onChange({ approval: event.target.value })}
        />
      ) : null}
      {has('overtime') ? (
        <Select
          label="Overtime type"
          options={OVERTIME_TYPES}
          value={values.overtime}
          onChange={(event) => onChange({ overtime: event.target.value })}
        />
      ) : null}
    </>
  );
}
