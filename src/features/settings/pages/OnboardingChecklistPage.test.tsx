import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { onboardingSteps, step, withSummary } from '../test/adminFixtures';
import { adminHandlers, callsOf, createBackend, type AdminBackend } from '../test/adminHandlers';
import OnboardingChecklistPage from './OnboardingChecklistPage';

const MEMBER = ['organization.read'];

function setup(init: Partial<AdminBackend> = {}, permissions = OWNER_PERMISSIONS) {
  const backend = createBackend(init);
  server.use(...adminHandlers(backend));
  renderInOrg(<OnboardingChecklistPage />, { context: contextWith(permissions) });
  return backend;
}

const steps = async () => {
  const list = await screen.findByRole('list', { name: 'Set-up steps' });
  return within(list).getAllByRole('listitem');
};

const stepNamed = async (title: string) => {
  const found = (await steps()).find((item) =>
    within(item).queryByRole('heading', { name: title }),
  );
  if (!found) throw new Error(`No step called ${title}`);
  return found;
};

describe('the progress', () => {
  it('says how many steps are finished, and how many are done, skipped and left', async () => {
    setup();

    expect(
      await screen.findByRole('heading', { name: '2 of 4 steps finished' }),
    ).toBeInTheDocument();
    const card = screen.getByRole('heading', { name: '2 of 4 steps finished' }).closest('div')
      ?.parentElement as HTMLElement;
    expect(card).toHaveTextContent('1 done');
    expect(card).toHaveTextContent('1 skipped');
    expect(card).toHaveTextContent('2 to do');
    const bar = screen.getByRole('progressbar', { name: 'Set-up progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuetext', '50% finished');
  });

  it('says that the practice is set up when nothing is left to do', async () => {
    setup({
      onboarding: withSummary(
        onboardingSteps().map((entry) => ({ ...entry, state: 'done' as const })),
      ),
    });

    expect(
      await screen.findByRole('heading', { name: 'Your practice is set up' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Every step is done or skipped.')).toBeInTheDocument();
  });
});

describe('the steps', () => {
  it('lists them in order with what each asks, what was found and where its state came from', async () => {
    setup();
    const items = await steps();

    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Complete the practice details');
    expect(items[0]).toHaveTextContent('Done');
    expect(items[0]).toHaveTextContent("Counted from your practice's data.");

    expect(items[1]).toHaveTextContent('Add your staff');
    expect(items[1]).toHaveTextContent('Invite the people who will record time.');
    expect(items[1]).toHaveTextContent('1 active staff member');
    expect(items[1]).toHaveTextContent('To do');

    expect(items[2]).toHaveTextContent('Only a person can complete this step.');
    expect(items[3]).toHaveTextContent('Skipped');
    expect(items[3]).toHaveTextContent('Marked skipped by Ada Lovelace');
  });

  it('links each step to the page where it is done', async () => {
    setup();
    await steps();

    expect(screen.getByRole('link', { name: 'Open Add your staff' })).toHaveAttribute(
      'href',
      '/acme/team/staff',
    );
    expect(
      screen.getByRole('link', { name: 'Open Complete the practice details' }),
    ).toHaveAttribute('href', '/acme/settings/practice');
  });
});

describe('marking a step', () => {
  it('marks a step done, and the progress follows', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await steps();

    await user.click(screen.getByRole('button', { name: 'Mark as done: Add your staff' }));

    await waitFor(() =>
      expect(callsOf(backend, 'PUT', '/onboarding/steps/invite_staff')[0]?.body).toEqual({
        state: 'done',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: '3 of 4 steps finished' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Add your staff marked done')).toBeInTheDocument();
    const row = await stepNamed('Add your staff');
    expect(row).toHaveTextContent('Done');
    expect(row).toHaveTextContent('Marked done by Ada Lovelace');
    expect(within(row).getByRole('button', { name: 'Undo: Add your staff' })).toBeInTheDocument();
  });

  it('skips a step, and takes the decision back', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await steps();

    await user.click(screen.getByRole('button', { name: 'Skip: Review the VAT codes' }));
    await waitFor(() =>
      expect(callsOf(backend, 'PUT', '/onboarding/steps/review_vat')[0]?.body).toEqual({
        state: 'skipped',
      }),
    );
    expect(await screen.findByText('Review the VAT codes marked skipped')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: '3 of 4 steps finished' }),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Undo: Review the VAT codes' }));
    await waitFor(() =>
      expect(callsOf(backend, 'PUT', '/onboarding/steps/review_vat')[1]?.body).toEqual({
        state: 'todo',
      }),
    );
    expect(await screen.findByText('Review the VAT codes is back on the list')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: '2 of 4 steps finished' }),
    ).toBeInTheDocument();
  });

  it('lets the data decide again when a skipped step is taken back', async () => {
    const user = userEvent.setup();
    setup({
      onboarding: withSummary([
        step('first_client', {
          title: 'Add your first client',
          state: 'skipped',
          source: 'manual',
          detected: true,
          updated_by_name: 'Ada Lovelace',
          updated_at: '2026-10-17T09:00:00Z',
        }),
      ]),
    });
    await steps();

    await user.click(screen.getByRole('button', { name: 'Undo: Add your first client' }));

    const row = await stepNamed('Add your first client');
    await waitFor(() => expect(row).toHaveTextContent('Done'));
    expect(row).toHaveTextContent("Counted from your practice's data.");
    expect(within(row).queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument();
  });

  it('offers nothing to do about a step the data has finished', async () => {
    setup();
    const row = await stepNamed('Complete the practice details');

    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(within(row).getByRole('link', { name: /^Open/ })).toBeInTheDocument();
  });

  it('says so when the step could not be marked', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'PUT /onboarding/steps': {
          status: 403,
          code: 'PERMISSION_DENIED',
          message: 'Not for you.',
        },
      },
    });
    await steps();

    await user.click(screen.getByRole('button', { name: 'Mark as done: Add your staff' }));

    expect(await screen.findByText("You don't have permission to do that")).toBeInTheDocument();
    expect(screen.getByText('Not for you.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 of 4 steps finished' })).toBeInTheDocument();
  });
});

describe('the permissions', () => {
  it('shows the checklist to a member but offers no way to mark a step', async () => {
    setup({}, MEMBER);
    await steps();

    expect(screen.queryByRole('button', { name: /^Mark as done/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Skip/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Marking steps needs permission to manage the onboarding checklist.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Add your staff' })).toBeInTheDocument();
  });

  it('needs permission to see the practice, and asks the API for nothing without it', async () => {
    const backend = setup({}, []);

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(callsOf(backend, 'GET', '/onboarding')).toHaveLength(0);
  });
});

describe('a failed load', () => {
  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /onboarding': { status: 500, code: 'SERVER_ERROR', message: 'Down.' } },
    });

    expect(await screen.findByText('Could not load the checklist')).toBeInTheDocument();
    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: '2 of 4 steps finished' }),
    ).toBeInTheDocument();
  });
});
