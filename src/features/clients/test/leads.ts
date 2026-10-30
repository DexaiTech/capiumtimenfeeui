import { http, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type { Lead, LeadCreate, LeadStatus, LeadSummary, LeadUpdate } from '../leads/types';

const STAMP = '2026-10-01T09:00:00Z';
const END = { next_cursor: null, has_more: false };

export function lead(id: string, name: string, extra: Partial<Lead> = {}): Lead {
  const acquisition = extra.acquisition_cost ?? 0;
  const onboarding = extra.onboarding_cost ?? 0;
  return {
    id,
    name,
    client_type: 'limited_company',
    contact_name: null,
    email: null,
    phone: null,
    source: null,
    notes: null,
    acquisition_cost: acquisition,
    onboarding_cost: onboarding,
    total_cost: acquisition + onboarding,
    status: 'open',
    archived_at: null,
    converted_at: null,
    converted_client_id: null,
    converted_client: null,
    created_by: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...extra,
  };
}

export const brightside = lead('lead-bright', 'Brightside Bakery Ltd', {
  contact_name: 'Bea Bright',
  email: 'bea@brightside.example',
  source: 'Referral',
  acquisition_cost: 25000,
  onboarding_cost: 5000,
});
export const corner = lead('lead-corner', 'Corner Cafe', {
  client_type: 'sole_trader',
  source: 'Website',
  acquisition_cost: 1250,
});
export const dunmore = lead('lead-dunmore', 'Dunmore Holdings', {
  status: 'converted',
  acquisition_cost: 40000,
  onboarding_cost: 15000,
  converted_at: STAMP,
  converted_client_id: 'client-dunmore',
  converted_client: { id: 'client-dunmore', code: 'C0042', name: 'Dunmore Holdings' },
});
export const oldLead = lead('lead-old', 'Old Prospect Ltd', {
  status: 'archived',
  archived_at: STAMP,
  acquisition_cost: 900,
});

export const testLeads: Lead[] = [brightside, corner, dunmore, oldLead];

/** The requests the fake API has seen, for assertions on exact bodies. */
export interface LeadCalls {
  lists: URLSearchParams[];
  creates: LeadCreate[];
  updates: Array<{ id: string; body: LeadUpdate }>;
  archives: string[];
  unarchives: string[];
  converts: Array<{ id: string; body: unknown }>;
}

export function newLeadCalls(): LeadCalls {
  return { lists: [], creates: [], updates: [], archives: [], unarchives: [], converts: [] };
}

/** The status the API derives: archived wins over converted. */
const statusOf = (entry: Lead): LeadStatus =>
  entry.archived_at ? 'archived' : entry.converted_client_id ? 'converted' : 'open';

function summaryOf(leads: Lead[]): LeadSummary {
  const totals = (status: LeadStatus) => {
    const rows = leads.filter((entry) => entry.status === status);
    const sum = (pick: (entry: Lead) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    return {
      count: rows.length,
      acquisition_cost: sum((row) => row.acquisition_cost),
      onboarding_cost: sum((row) => row.onboarding_cost),
      total_cost: sum((row) => row.total_cost),
    };
  };
  return { open: totals('open'), converted: totals('converted'), archived: totals('archived') };
}

/**
 * A fake of the lead endpoints that keeps its own state: what a test adds, edits, converts or
 * archives shows up in the next list and in the totals.
 */
export function leadHandlers(
  initial: Lead[] = testLeads,
  calls: LeadCalls = newLeadCalls(),
): HttpHandler[] {
  let leads = initial.map((entry) => ({ ...entry }));
  const replace = (next: Lead) => {
    const settled = {
      ...next,
      status: statusOf(next),
      total_cost: next.acquisition_cost + next.onboarding_cost,
    };
    leads = leads.map((entry) => (entry.id === next.id ? settled : entry));
    return settled;
  };
  const find = (id: unknown) => leads.find((entry) => entry.id === String(id));

  return [
    http.get(orgApiPath('/leads/summary'), () => ok(summaryOf(leads))),
    http.get(orgApiPath('/leads'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.lists.push(params);
      const status = params.get('status') ?? 'open';
      const q = params.get('q')?.toLowerCase() ?? '';
      const rows = leads.filter(
        (entry) =>
          entry.status === status &&
          (q === '' ||
            [entry.name, entry.contact_name, entry.email].some((value) =>
              (value ?? '').toLowerCase().includes(q),
            )),
      );
      return ok(rows, { meta: END });
    }),
    http.post(orgApiPath('/leads'), async ({ request }) => {
      const body = (await request.json()) as LeadCreate;
      calls.creates.push(body);
      const created = lead(`lead-${leads.length + 1}`, body.name, {
        ...body,
        client_type: body.client_type ?? 'limited_company',
        created_at: '2026-10-30T09:00:00Z',
      } as Partial<Lead>);
      leads = [created, ...leads];
      return ok(created, { status: 201 });
    }),
    http.patch(orgApiPath('/leads/:id'), async ({ params, request }) => {
      const body = (await request.json()) as LeadUpdate;
      calls.updates.push({ id: String(params.id), body });
      const current = find(params.id);
      if (!current) return fail(404, 'RESOURCE_NOT_FOUND', 'Lead not found.');
      return ok(replace({ ...current, ...body } as Lead));
    }),
    http.post(orgApiPath('/leads/:id/archive'), ({ params }) => {
      calls.archives.push(String(params.id));
      const current = find(params.id);
      if (!current) return fail(404, 'RESOURCE_NOT_FOUND', 'Lead not found.');
      return ok(replace({ ...current, archived_at: current.archived_at ?? STAMP }));
    }),
    http.post(orgApiPath('/leads/:id/unarchive'), ({ params }) => {
      calls.unarchives.push(String(params.id));
      const current = find(params.id);
      if (!current) return fail(404, 'RESOURCE_NOT_FOUND', 'Lead not found.');
      return ok(replace({ ...current, archived_at: null }));
    }),
    http.post(orgApiPath('/leads/:id/convert'), async ({ params, request }) => {
      const body: unknown = await request.json().catch(() => null);
      calls.converts.push({ id: String(params.id), body });
      const current = find(params.id);
      if (!current) return fail(404, 'RESOURCE_NOT_FOUND', 'Lead not found.');
      if (current.archived_at) {
        return fail(409, 'LEAD_ARCHIVED', 'Unarchive the lead before converting it.');
      }
      if (current.converted_client_id) {
        return fail(409, 'LEAD_ALREADY_CONVERTED', 'This lead is already a client.');
      }
      const clientId = `client-${current.id}`;
      return ok(
        replace({
          ...current,
          converted_at: '2026-10-30T09:00:00Z',
          converted_client_id: clientId,
          converted_client: { id: clientId, code: 'C0100', name: current.name },
        }),
      );
    }),
  ];
}
