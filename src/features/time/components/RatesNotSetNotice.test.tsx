import { screen, waitFor } from '@testing-library/react';
import { http, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { RatesNotSetNotice } from './RatesNotSetNotice';

function checklist(state: 'todo' | 'done' | 'skipped'): JsonBodyType {
  return {
    steps: [
      {
        key: 'grades_rates',
        title: 'Grades and default rates',
        description: '',
        state,
        source: 'auto',
        detected: state === 'done',
        detail: null,
        link: 'team/grades',
        updated_by_name: null,
        updated_at: null,
      },
    ],
    summary: { total: 1, done: 0, skipped: 0, todo: 1, percent: 0, complete: false },
  };
}

function setup(state: 'todo' | 'done' | 'skipped', permissions = OWNER_PERMISSIONS) {
  server.use(http.get(orgApiPath('/onboarding'), () => ok(checklist(state))));
  renderInOrg(<RatesNotSetNotice />, { context: contextWith(permissions) });
}

describe('RatesNotSetNotice', () => {
  it('warns that time is worth £0 until grade rates are set, and links to them', async () => {
    setup('todo');
    expect(await screen.findByText('Rates are not set up yet')).toBeInTheDocument();
    expect(screen.getByText(/valued at £0/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set rates' })).toHaveAttribute(
      'href',
      '/acme/team/grades',
    );
  });

  it('tells someone who cannot set rates to ask, without a link', async () => {
    setup('todo', STAFF_PERMISSIONS);
    expect(
      await screen.findByText(/Ask your administrator to set the grade rates/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Set rates' })).not.toBeInTheDocument();
  });

  it('says nothing once the rates step is done', async () => {
    setup('done');
    await waitFor(() =>
      expect(screen.queryByText('Rates are not set up yet')).not.toBeInTheDocument(),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByText('Rates are not set up yet')).not.toBeInTheDocument();
  });
});
