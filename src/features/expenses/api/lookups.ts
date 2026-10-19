import { useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';
import type { Organization } from '@/types/organization';

import type { ExpenseSettings } from '../types';
import { expensesApi } from './expensesApi';
import { expenseKeys } from './keys';

/** A client named by id, for a cell of a list (cached; empty while unknown or not readable). */
export function useClientName(clientId: string | null | undefined) {
  const { organization, can } = useOrg();
  return useQuery({
    queryKey: expenseKeys.clientName(organization.id, clientId ?? ''),
    queryFn: ({ signal }) => expensesApi.getClient(organization.id, clientId ?? '', signal),
    enabled: Boolean(clientId) && can('client.read'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useJobName(jobId: string | null | undefined) {
  const { organization, can } = useOrg();
  return useQuery({
    queryKey: expenseKeys.jobName(organization.id, jobId ?? ''),
    queryFn: ({ signal }) => expensesApi.getJob(organization.id, jobId ?? '', signal),
    enabled: Boolean(jobId) && can('job.read'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** The practice settings the API sends with every practice (`OrganizationRead`). */
interface ExpensePracticeFields {
  receipt_required_threshold?: number;
  mileage_rate?: number;
  expense_markup_bp?: number;
}

/**
 * The practice settings the expense screens read: the receipt threshold, the mileage rate and
 * the markup. A value that is not there is null and the screen leaves the hint out instead of
 * guessing.
 */
export function useExpenseSettings(): ExpenseSettings {
  const { organization } = useOrg();
  const practice = organization as Organization & ExpensePracticeFields;
  return {
    receiptThreshold: practice.receipt_required_threshold ?? null,
    mileageRate: practice.mileage_rate ?? null,
    markupBp: practice.expense_markup_bp ?? null,
  };
}
