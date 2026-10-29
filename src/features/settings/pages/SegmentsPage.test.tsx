import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { findRowAction, rowActionNames } from '@/test/rowActions';
import {
  gold,
  newSegmentCalls,
  orgApiPath,
  retail,
  segment,
  segmentHandlers,
  silver,
  testSegments,
  type SegmentCalls,
} from '@/test/segments';
import { fail, ok, server } from '@/test/server';

import SegmentsPage from './SegmentsPage';

type User = ReturnType<typeof userEvent.setup>;

const row = (name: RegExp) => screen.findByRole('row', { name });

async function actionsOf(name: string) {
  await screen.findByRole('group', { name: `Actions for ${name}` });
  return rowActionNames(`Actions for ${name}`);
}

async function chooseAction(user: User, name: string, action: string) {
  await user.click(await findRowAction(`Actions for ${name}`, action));
}

let calls: SegmentCalls;

function setup(segments = testSegments) {
  calls = newSegmentCalls();
  server.use(...segmentHandlers(segments, calls));
}

beforeEach(() => setup());

describe('SegmentsPage: the list', () => {
  it('lists the segments with their clients, staff and status', async () => {
    renderInOrg(<SegmentsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Client Segments' })).toBeInTheDocument();
    const goldRow = within(await row(/^Gold/));
    expect(goldRow.getByText('Our largest fee payers')).toBeInTheDocument();
    expect(goldRow.getByRole('link', { name: '3 clients in Gold' })).toHaveAttribute(
      'href',
      '/acme/clients?segment=Gold',
    );
    expect(goldRow.getByText('Active')).toBeInTheDocument();
    const retailRow = within(await row(/^Retail/));
    expect(retailRow.getByText('Inactive')).toBeInTheDocument();
    expect(retailRow.queryByRole('link')).not.toBeInTheDocument();

    expect(await screen.findByRole('tab', { name: /^All segments\s*3$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^Active\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Inactive\s*1$/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 segments')).toBeInTheDocument();
  });

  it('filters by tab and by search', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await row(/^Gold/);

    await user.click(screen.getByRole('tab', { name: /^Inactive/ }));
    expect(await row(/^Retail/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Gold/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^All segments/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search segments' }), 'silv');
    expect(await row(/^Silver/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Gold/ })).not.toBeInTheDocument(),
    );
  });

  it('shows the empty state and the error state with a retry', async () => {
    const user = userEvent.setup();
    setup([]);
    const first = renderInOrg(<SegmentsPage />);
    expect(await screen.findByText('No segments yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add segment' })).toHaveLength(2);
    first.unmount();

    let failing = true;
    server.use(
      http.get(orgApiPath('/segments'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok([silver]),
      ),
    );
    renderInOrg(<SegmentsPage />);
    expect(await screen.findByText('Could not load the client segments')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/^Silver/)).toBeInTheDocument();
  });
});

describe('SegmentsPage: permissions', () => {
  it('lets any member read the list but offers no change without settings.manage', async () => {
    renderInOrg(<SegmentsPage />, { context: contextWith(STAFF_PERMISSIONS) });
    expect(await row(/^Gold/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add segment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Changing segments needs permission to manage settings/),
    ).toBeInTheDocument();
  });

  it('offers activate on an inactive segment and deactivate on an active one', async () => {
    renderInOrg(<SegmentsPage />);
    expect(await actionsOf('Gold')).toEqual(['Edit', 'Deactivate', 'Delete']);
    expect(await actionsOf('Retail')).toEqual(['Edit', 'Activate', 'Delete']);
  });
});

describe('SegmentFormPanel', () => {
  it('adds a segment and sends exactly the typed fields', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Add segment' }));
    const dialog = await screen.findByRole('region', { name: 'Add segment' });
    expectRequiredFields(dialog, { required: ['Name'], optional: ['Description'] });

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), '  Charities  ');
    await user.click(within(dialog).getByRole('button', { name: 'Add segment' }));

    expect(await screen.findByText('Charities added')).toBeInTheDocument();
    expect(calls.creates).toEqual([{ name: 'Charities', description: null }]);
    expect(await row(/^Charities/)).toBeInTheDocument();
    expect(screen.getByText('Showing 4 of 4 segments')).toBeInTheDocument();
  });

  it('asks for a name', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Add segment' }));
    const dialog = await screen.findByRole('region', { name: 'Add segment' });

    await user.click(within(dialog).getByRole('button', { name: 'Add segment' }));
    expect(await within(dialog).findByText('Enter a name for the segment')).toBeInTheDocument();
    expect(calls.creates).toEqual([]);
  });

  it('shows a duplicate name on the field and keeps the form open', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Add segment' }));
    const dialog = await screen.findByRole('region', { name: 'Add segment' });

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'gold');
    await user.click(within(dialog).getByRole('button', { name: 'Add segment' }));

    expect(
      await within(dialog).findByText('A segment with this name already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Add segment' })).toBeInTheDocument();
  });

  it('renames a segment, sending only what changed, and says clients follow', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await row(/^Gold/);
    await chooseAction(user, 'Gold', 'Edit');
    const dialog = await screen.findByRole('region', { name: 'Edit segment' });

    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Gold');
    expect(within(dialog).getByText(/also renames it on its 3 clients/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save segment' })).toBeDisabled();

    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Platinum');
    await user.click(within(dialog).getByRole('button', { name: 'Save segment' }));

    expect(await screen.findByText('Platinum saved')).toBeInTheDocument();
    expect(calls.updates).toEqual([{ id: gold.id, body: { name: 'Platinum' } }]);
    expect(await row(/^Platinum/)).toBeInTheDocument();
  });
});

describe('SegmentsPage: deactivating, activating and deleting', () => {
  it('deactivates and activates', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await row(/^Silver/);

    await chooseAction(user, 'Silver', 'Deactivate');
    expect(await screen.findByText('Silver deactivated')).toBeInTheDocument();
    expect(calls.updates).toEqual([{ id: silver.id, body: { is_active: false } }]);

    await chooseAction(user, 'Retail', 'Activate');
    expect(await screen.findByText('Retail activated')).toBeInTheDocument();
    expect(calls.updates.at(-1)).toEqual({ id: retail.id, body: { is_active: true } });
    expect(await screen.findByRole('tab', { name: /^Active\s*2$/ })).toBeInTheDocument();
  });

  it('deletes an unused segment after asking', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await row(/^Retail/);

    await chooseAction(user, 'Retail', 'Delete');
    const dialog = await screen.findByRole('dialog', { name: 'Delete segment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Retail deleted')).toBeInTheDocument();
    expect(calls.deletes).toEqual([retail.id]);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Retail/ })).not.toBeInTheDocument(),
    );
  });

  it('says a segment that clients have was deactivated instead', async () => {
    const user = userEvent.setup();
    renderInOrg(<SegmentsPage />);
    await row(/^Silver/);

    await chooseAction(user, 'Silver', 'Delete');
    const dialog = await screen.findByRole('dialog', { name: 'Delete segment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Silver deactivated instead')).toBeInTheDocument();
    expect(within(await row(/^Silver/)).getByText('Inactive')).toBeInTheDocument();
  });

  it('warns that staff stop looking after a segment that is deleted', async () => {
    const user = userEvent.setup();
    setup([segment('seg-x', 'Charities', { staff_count: 2 })]);
    renderInOrg(<SegmentsPage />);
    await row(/^Charities/);

    await chooseAction(user, 'Charities', 'Delete');
    expect(await screen.findByText(/2 staff look after it/)).toBeInTheDocument();
  });
});
