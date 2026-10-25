import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { GettingStartedCard } from './GettingStartedCard';

function step(key: string, title: string, state: 'todo' | 'done' | 'skipped', link: string) {
  return {
    key,
    title,
    description: `${title}: what to do`,
    state,
    source: 'auto',
    detected: state === 'done',
    detail: null,
    link,
    updated_by_name: null,
    updated_at: null,
  };
}

const STEPS = [
  step('practice', 'Describe the practice', 'done', 'settings/practice'),
  step('grades', 'Add grades', 'todo', 'team/grades'),
  step('staff', 'Add staff', 'todo', 'team/staff'),
  step('clients', 'Add clients', 'todo', 'clients'),
  step('jobs', 'Add jobs', 'todo', 'jobs'),
];

function checklist(steps = STEPS) {
  const done = steps.filter((item) => item.state === 'done').length;
  const todo = steps.filter((item) => item.state === 'todo').length;
  return {
    steps,
    summary: {
      total: steps.length,
      done,
      skipped: 0,
      todo,
      percent: Math.round(((steps.length - todo) / steps.length) * 100),
      complete: todo === 0,
    },
  };
}

function setup(body: JsonBodyType = checklist(), permissions: string[] = OWNER_PERMISSIONS) {
  server.use(http.get(orgApiPath('/onboarding'), () => ok(body)));
  renderInOrg(<GettingStartedCard />, { context: contextWith(permissions) });
}

describe('GettingStartedCard', () => {
  it('shows how far the set-up has got and the next three steps, each one click away', async () => {
    setup();
    const card = await screen.findByRole('region', { name: 'Getting started' });
    expect(card).toHaveTextContent('1 of 5 steps finished');
    const steps = within(card).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Next: Add grades');
    expect(within(card).getByRole('link', { name: 'Open Add grades' })).toHaveAttribute(
      'href',
      '/acme/team/grades',
    );
    expect(within(card).queryByText('Add jobs')).not.toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'See all 5 steps' })).toHaveAttribute(
      'href',
      '/acme/settings/onboarding',
    );
    expect(within(card).getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '/acme/help',
    );
  });

  it('is not shown once every step is done or skipped', async () => {
    setup(checklist(STEPS.map((item) => ({ ...item, state: 'done' as const }))));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Getting started' })).not.toBeInTheDocument(),
    );
  });

  it('can be hidden, and stays hidden', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: 'Hide getting started' }));
    expect(screen.queryByRole('region', { name: 'Getting started' })).not.toBeInTheDocument();
    expect(Object.keys(window.localStorage).some((key) => key.includes('getting-started'))).toBe(
      true,
    );
  });

  it('tells a member who cannot manage the set-up that the administrator is doing it', async () => {
    setup(checklist(), STAFF_PERMISSIONS);
    const card = await screen.findByRole('region', { name: 'Getting started' });
    expect(card).toHaveTextContent('Your administrator is setting the practice up');
    expect(within(card).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('says nothing when the checklist cannot be loaded', async () => {
    server.use(
      http.get(orgApiPath('/onboarding'), () => fail(500, 'INTERNAL_ERROR', 'Something failed')),
    );
    renderInOrg(<GettingStartedCard />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region', { name: 'Getting started' })).not.toBeInTheDocument();
  });
});
