import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import type { Organization } from '@/features/organizations';
import { fail, ok, server } from '@/test/server';
import type { WipValuationPreview, WipValuationSource } from '@/types/organization';

import { ORG_ID, orgContext, staffRole, testOrganization } from '../test/fixtures';
import { orgPath } from '../test/handlers';
import { renderSettings } from '../test/render';
import GeneralSettingsPage from './GeneralSettingsPage';

const NO_CHANGE: WipValuationPreview = {
  entries_changed: 0,
  wip_before: 100000,
  wip_after: 100000,
  skipped: { billed: 0, in_draft: 0, locked: 0, written_off: 0 },
  too_many: false,
};

const IMPACT: WipValuationPreview = {
  entries_changed: 12,
  wip_before: 100000,
  wip_after: 112500,
  skipped: { billed: 3, in_draft: 1, locked: 0, written_off: 2 },
  too_many: false,
};

interface Calls {
  previews: unknown[];
  puts: unknown[];
}

/** `preview` answers the impact preview; the PUT answers with the saved practice or `put`. */
function backend(
  preview: WipValuationPreview = NO_CHANGE,
  put?: () => ReturnType<typeof fail>,
): Calls {
  const calls: Calls = { previews: [], puts: [] };
  server.use(
    http.post(orgPath('/wip-valuation/preview'), async ({ request }) => {
      calls.previews.push(await request.json());
      return ok(preview);
    }),
    http.put(orgPath('/wip-valuation'), async ({ request }) => {
      const body = (await request.json()) as { sources: WipValuationSource[] };
      calls.puts.push(body);
      if (put) return put();
      return ok({ ...testOrganization, wip_valuation_sources: body.sources });
    }),
  );
  return calls;
}

const fetches = new Map<string, number>();

/** Watches one query key, so a test can see it refetched after a save. */
function Probe({ name, queryKey }: { name: string; queryKey: readonly unknown[] }) {
  useQuery({
    queryKey,
    queryFn: () => {
      const count = (fetches.get(name) ?? 0) + 1;
      fetches.set(name, count);
      return count;
    },
  });
  return null;
}

/** Shows what the cached practice context says, as the shell would read it. */
function CachedSources() {
  const { data } = useQuery({
    queryKey: queryKeys.organizationBySlug(testOrganization.slug),
    queryFn: () => orgContext(),
    staleTime: Infinity,
  });
  return (
    <output aria-label="Cached sources">
      {data?.organization.wip_valuation_sources.join(',')}
    </output>
  );
}

async function openCard(
  organization: Partial<Organization> = {},
  context = orgContext(),
  extra: ReactNode = null,
) {
  const user = userEvent.setup();
  renderSettings(
    <>
      <GeneralSettingsPage />
      {extra}
    </>,
    { context: { ...context, organization: { ...testOrganization, ...organization } } },
  );
  await user.click(screen.getByRole('tab', { name: 'WIP & billing' }));
  return { user, card: within(screen.getByRole('form', { name: 'WIP valuation' })) };
}

type Card = Awaited<ReturnType<typeof openCard>>['card'];

/** "1 Client agreed rate", … for the rates in use, in their order. */
const used = (card: Card) =>
  within(card.getByRole('list', { name: 'Rates used, in priority order' }))
    .getAllByRole('listitem')
    .map((row) => {
      const match = /^(\d)(.+?rate)The /.exec(row.textContent);
      return match ? `${match[1] ?? ''} ${match[2] ?? ''}` : row.textContent;
    });

/** The names of the rates not used, in their order. */
const notUsed = (card: Card) =>
  within(card.getByRole('list', { name: 'Not used' }))
    .getAllByRole('listitem')
    .map((row) => /^(.+?rate)The /.exec(row.textContent)?.[1] ?? row.textContent);

describe('General settings: WIP valuation (APT84)', () => {
  it('sits under the WIP and billing card and lists the rates in their saved order', async () => {
    const { card } = await openCard();

    const panel = screen.getByRole('tabpanel', { name: 'WIP & billing' });
    expect(
      within(panel)
        .getAllByRole('form')
        .map((form) => form.getAttribute('aria-label')),
    ).toEqual(['WIP and billing', 'WIP valuation']);
    expect(card.getByRole('heading', { name: 'WIP valuation' })).toBeInTheDocument();
    expect(
      card.getByText(
        'Choose which rates value your work in progress, and the order they are tried in. The first enabled rate that applies is used.',
      ),
    ).toBeInTheDocument();
    expect(used(card)).toEqual([
      '1 Client agreed rate',
      '2 Service specific rate',
      '3 Staff specific rate',
      '4 Grade specific rate',
    ]);
    expect(card.getByText('The rate agreed with the client')).toBeInTheDocument();
    expect(card.getByText("The rate set for the job's service")).toBeInTheDocument();
    expect(
      card.getByText('The rate set for the grade of the person who recorded the time'),
    ).toBeInTheDocument();
    expect(card.getByText('The rate set for that person')).toBeInTheDocument();
    for (const name of [
      'Client agreed rate',
      'Service specific rate',
      'Staff specific rate',
      'Grade specific rate',
    ]) {
      expect(card.getByRole('switch', { name })).toBeChecked();
    }
    expect(card.queryByRole('list', { name: 'Not used' })).not.toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Move Client agreed rate up' })).toBeDisabled();
    expect(card.getByRole('button', { name: 'Move Grade specific rate down' })).toBeDisabled();
    expect(card.getByRole('button', { name: 'Save WIP valuation' })).toBeDisabled();
  });

  it('reorders with the up and down buttons, keeping the focus on the button used', async () => {
    const { user, card } = await openCard();

    const up = card.getByRole('button', { name: 'Move Grade specific rate up' });
    await user.click(up);
    expect(used(card)).toEqual([
      '1 Client agreed rate',
      '2 Service specific rate',
      '3 Grade specific rate',
      '4 Staff specific rate',
    ]);
    expect(card.getByRole('button', { name: 'Move Grade specific rate up' })).toHaveFocus();
    expect(card.getByRole('button', { name: 'Move Staff specific rate down' })).toBeDisabled();

    await user.click(card.getByRole('button', { name: 'Move Client agreed rate down' }));
    expect(used(card)).toEqual([
      '1 Service specific rate',
      '2 Client agreed rate',
      '3 Grade specific rate',
      '4 Staff specific rate',
    ]);
    expect(card.getByRole('button', { name: 'Move Client agreed rate down' })).toHaveFocus();
    expect(card.getByRole('button', { name: 'Save WIP valuation' })).toBeEnabled();

    await user.click(card.getByRole('button', { name: 'Discard changes' }));
    expect(used(card)[0]).toBe('1 Client agreed rate');
    expect(card.getByRole('button', { name: 'Save WIP valuation' })).toBeDisabled();
  });

  it('moves a rate switched off to Not used, closes up the numbers, and back at the end', async () => {
    const { user, card } = await openCard();

    await user.click(card.getByRole('switch', { name: 'Service specific rate' }));
    expect(used(card)).toEqual([
      '1 Client agreed rate',
      '2 Staff specific rate',
      '3 Grade specific rate',
    ]);
    expect(notUsed(card)).toEqual(['Service specific rate']);
    expect(card.getByRole('switch', { name: 'Service specific rate' })).not.toBeChecked();
    expect(card.getByRole('switch', { name: 'Service specific rate' })).toHaveFocus();
    expect(
      card.queryByRole('button', { name: 'Move Service specific rate up' }),
    ).not.toBeInTheDocument();

    await user.click(card.getByRole('switch', { name: 'Service specific rate' }));
    expect(used(card)).toEqual([
      '1 Client agreed rate',
      '2 Staff specific rate',
      '3 Grade specific rate',
      '4 Service specific rate',
    ]);
    expect(card.queryByRole('list', { name: 'Not used' })).not.toBeInTheDocument();
  });

  it('refuses to switch off the last rate in use', async () => {
    const { user, card } = await openCard({ wip_valuation_sources: ['staff'] });

    expect(used(card)).toEqual(['1 Staff specific rate']);
    expect(notUsed(card)).toEqual([
      'Client agreed rate',
      'Service specific rate',
      'Grade specific rate',
    ]);
    await user.click(card.getByRole('switch', { name: 'Staff specific rate' }));

    expect(card.getByRole('alert')).toHaveTextContent('Keep at least one rate switched on.');
    expect(card.getByRole('switch', { name: 'Staff specific rate' })).toBeChecked();
    expect(card.getByRole('button', { name: 'Save WIP valuation' })).toBeDisabled();

    await user.click(card.getByRole('switch', { name: 'Grade specific rate' }));
    expect(card.queryByRole('alert')).not.toBeInTheDocument();
    expect(used(card)).toEqual(['1 Staff specific rate', '2 Grade specific rate']);
  });

  it('saves at once, without re-valuing, when no unbilled time would change', async () => {
    const calls = backend(NO_CHANGE);
    const { user, card } = await openCard();

    await user.click(card.getByRole('button', { name: 'Move Grade specific rate up' }));
    await user.click(card.getByRole('button', { name: 'Save WIP valuation' }));

    expect(await screen.findByText('WIP valuation saved')).toBeInTheDocument();
    expect(calls.previews).toEqual([{ sources: ['client', 'service', 'grade', 'staff'] }]);
    expect(calls.puts).toEqual([
      { sources: ['client', 'service', 'grade', 'staff'], revalue: false },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before re-valuing, says what changes, and re-values when confirmed', async () => {
    const calls = backend(IMPACT);
    const { user, card } = await openCard();

    await user.click(card.getByRole('switch', { name: 'Grade specific rate' }));
    await user.click(card.getByRole('button', { name: 'Save WIP valuation' }));

    let dialog = await screen.findByRole('dialog', { name: 'Re-value work in progress?' });
    expect(dialog).toHaveTextContent(
      '12 entries of unbilled time will be re-valued at the new order.',
    );
    expect(dialog).toHaveTextContent('WIP £1,000.00 → £1,125.00');
    expect(dialog).toHaveTextContent('Not changed: 3 billed, 1 in a draft invoice, 2 written off.');

    // Cancel saves nothing and keeps the change.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.puts).toEqual([]);
    expect(card.getByRole('button', { name: 'Save WIP valuation' })).toBeEnabled();

    await user.click(card.getByRole('button', { name: 'Save WIP valuation' }));
    dialog = await screen.findByRole('dialog', { name: 'Re-value work in progress?' });
    await user.click(within(dialog).getByRole('button', { name: 'Re-value and save' }));

    expect(await screen.findByText('WIP valuation saved')).toBeInTheDocument();
    expect(calls.puts).toEqual([{ sources: ['client', 'service', 'staff'], revalue: true }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers to save without re-valuing when there is too much time to re-value here', async () => {
    const calls = backend({ ...IMPACT, entries_changed: 25000, too_many: true });
    const { user, card } = await openCard();

    await user.click(card.getByRole('switch', { name: 'Grade specific rate' }));
    await user.click(card.getByRole('button', { name: 'Save WIP valuation' }));

    const dialog = await screen.findByRole('dialog', { name: 'Save without re-valuing?' });
    expect(dialog).toHaveTextContent(
      '25000 entries of unbilled time would change, more than can be re-valued here. Save the order now, then re-value past time in Team & Rates → Change Rates on Past Time.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save without re-valuing' }));

    expect(await screen.findByText('WIP valuation saved')).toBeInTheDocument();
    expect(calls.puts).toEqual([{ sources: ['client', 'service', 'staff'], revalue: false }]);
  });

  it('shows a 422 of the save in the card, and in the dialog when it is open', async () => {
    const calls = backend(NO_CHANGE, () =>
      fail(422, 'WIP_VALUATION_SOURCES', 'Keep at least one rate switched on.'),
    );
    const { user, card } = await openCard();

    await user.click(card.getByRole('button', { name: 'Move Grade specific rate up' }));
    await user.click(card.getByRole('button', { name: 'Save WIP valuation' }));
    const alert = await card.findByRole('alert');
    expect(alert).toHaveTextContent('Keep at least one rate switched on.');
    expect(alert).toHaveTextContent('req-test-123');
    expect(calls.puts).toHaveLength(1);
    expect(card.getByRole('button', { name: 'Save WIP valuation' })).toBeEnabled();

    const tooMany =
      'Too many entries to re-value here. Use Team & Rates → Change Rates on Past Time.';
    backend(IMPACT, () => fail(422, 'VALIDATION_ERROR', tooMany));
    await user.click(card.getByRole('button', { name: 'Save WIP valuation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Re-value work in progress?' });
    await user.click(within(dialog).getByRole('button', { name: 'Re-value and save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(tooMany);
    expect(screen.getByRole('dialog', { name: 'Re-value work in progress?' })).toBeInTheDocument();
  });

  it('refreshes the practice, WIP, time and job figures after saving', async () => {
    backend(IMPACT);
    fetches.clear();
    const { user, card } = await openCard({}, orgContext(), [
      <Probe key="wip" name="wip" queryKey={[...queryKeys.org.wip(ORG_ID), 'probe']} />,
      <Probe key="time" name="time" queryKey={[...queryKeys.org.time(ORG_ID), 'probe']} />,
      <Probe key="jobs" name="jobs" queryKey={[...queryKeys.org.jobs(ORG_ID), 'probe']} />,
      <CachedSources key="cached" />,
    ]);
    await waitFor(() => expect(Object.fromEntries(fetches)).toEqual({ wip: 1, time: 1, jobs: 1 }));
    expect(screen.getByRole('status', { name: 'Cached sources' })).toHaveTextContent(
      'client,service,staff,grade',
    );

    await user.click(card.getByRole('switch', { name: 'Grade specific rate' }));
    await user.click(card.getByRole('button', { name: 'Save WIP valuation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Re-value work in progress?' });
    await user.click(within(dialog).getByRole('button', { name: 'Re-value and save' }));

    await waitFor(() => expect(Object.fromEntries(fetches)).toEqual({ wip: 2, time: 2, jobs: 2 }));
    expect(screen.getByRole('status', { name: 'Cached sources' })).toHaveTextContent(
      /^client,service,staff$/,
    );
  });

  it('is read-only without organization.update', async () => {
    const { card } = await openCard(
      {},
      orgContext({ role: staffRole, permissions: ['organization.read'] }),
    );

    expect(used(card)).toHaveLength(4);
    expect(card.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
    expect(card.getByRole('switch', { name: 'Client agreed rate' })).toBeDisabled();
    expect(card.queryByRole('button', { name: 'Save WIP valuation' })).not.toBeInTheDocument();
  });
});
