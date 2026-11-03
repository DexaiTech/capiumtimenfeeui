import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  branchesOnContext,
  branchHandlers,
  newBranchCalls,
  orgApiPath,
  testBranches,
  type BranchCalls,
} from '@/test/branches';
import { contextWith, ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { findRowAction, rowActionNames } from '@/test/rowActions';
import { ok, server } from '@/test/server';

import BranchesPage from './BranchesPage';

const row = (name: RegExp) => screen.findByRole('row', { name });

let calls: BranchCalls;

function setup(branches = testBranches) {
  calls = newBranchCalls();
  server.use(...branchHandlers(branches, calls));
}

beforeEach(() => setup());

describe('BranchesPage: the list (APT74)', () => {
  it('lists the branches with their clients and status', async () => {
    renderInOrg(<BranchesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Branches' })).toBeInTheDocument();
    const londonRow = within(await row(/^London/));
    expect(londonRow.getByRole('link', { name: '2 clients in London' })).toHaveAttribute(
      'href',
      '/acme/clients?branch=0198c1f2-0000-7000-8000-0000000b0001',
    );
    expect(londonRow.getByText('Active')).toBeInTheDocument();
    const bathRow = within(await row(/^Bath/));
    expect(bathRow.getByText('Inactive')).toBeInTheDocument();
    expect(bathRow.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 branches')).toBeInTheDocument();
  });

  it('adds a branch, asking for its name', async () => {
    const user = userEvent.setup();
    renderInOrg(<BranchesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add branch' }));
    const dialog = await screen.findByRole('region', { name: 'Add branch' });
    expectRequiredFields(dialog, { required: ['Name'], optional: [] });

    await user.click(within(dialog).getByRole('button', { name: 'Add branch' }));
    expect(await within(dialog).findByText('Enter a name for the branch')).toBeInTheDocument();
    expect(calls.creates).toEqual([]);

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), '  Manchester ');
    await user.click(within(dialog).getByRole('button', { name: 'Add branch' }));
    expect(await screen.findByText('Manchester added')).toBeInTheDocument();
    expect(calls.creates).toEqual([{ name: 'Manchester' }]);
    expect(await row(/^Manchester/)).toBeInTheDocument();
  });

  it('deactivates a branch and deletes one after asking', async () => {
    const user = userEvent.setup();
    renderInOrg(<BranchesPage />);
    await screen.findByRole('group', { name: 'Actions for Leeds' });
    expect(rowActionNames('Actions for Leeds')).toEqual(['Edit', 'Deactivate', 'Delete']);
    expect(rowActionNames('Actions for Bath')).toEqual(['Edit', 'Activate', 'Delete']);

    await user.click(await findRowAction('Actions for Leeds', 'Deactivate'));
    expect(await screen.findByText('Leeds deactivated')).toBeInTheDocument();
    expect(calls.updates).toEqual([
      { id: '0198c1f2-0000-7000-8000-0000000b0002', body: { is_active: false } },
    ]);

    await user.click(await findRowAction('Actions for London', 'Delete'));
    const confirm = await screen.findByRole('dialog', { name: 'Delete branch?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('London deactivated instead')).toBeInTheDocument();
    expect(calls.deletes).toEqual(['0198c1f2-0000-7000-8000-0000000b0001']);
  });

  it('lets any member read the list but offers no change without settings.manage', async () => {
    renderInOrg(<BranchesPage />, { context: contextWith(STAFF_PERMISSIONS) });
    expect(await row(/^London/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add branch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Changing branches needs permission to manage settings/),
    ).toBeInTheDocument();
  });
});

describe('BranchesPage: the "Use branches" switch (APT74)', () => {
  it('is off by default and switching it on saves the practice setting', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(orgApiPath(''), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return ok({ ...ownerContext.organization, ...body });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<BranchesPage />);

    const toggle = screen.getByRole('switch', { name: 'Use branches' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(/each client needs a branch/);
    await user.click(toggle);

    expect(await screen.findByText('Branches switched on')).toBeInTheDocument();
    expect(bodies).toEqual([{ branches_enabled: true }]);
  });

  it('shows the setting on, and only someone who may update the practice changes it', async () => {
    renderInOrg(<BranchesPage />, {
      context: { ...contextWith(STAFF_PERMISSIONS), organization: branchesOnContext.organization },
    });
    const toggle = screen.getByRole('switch', { name: 'Use branches' });
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    expect(await row(/^London/)).toBeInTheDocument();
  });
});
