import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { contextWith } from '@/test/orgFixtures';

import { FLOW_PHASES } from '../flowData';
import HelpPage from './HelpPage';

describe('HelpPage', () => {
  it('opens on the flow chart, with every step in order and linked to its page', () => {
    renderInOrg(<HelpPage />, { route: '/acme/help' });
    expect(screen.getByRole('heading', { level: 1, name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'How it works', selected: true })).toBeInTheDocument();

    const steps = FLOW_PHASES.flatMap((phase) => phase.steps);
    for (const step of steps) {
      const link = screen.getByRole('link', { name: step.title });
      expect(link.getAttribute('href')).toMatch(/^\/acme\//);
    }
    // The first step opens the practice settings; the invoice step opens Prepare Invoice.
    expect(screen.getByRole('link', { name: 'Describe the practice' })).toHaveAttribute(
      'href',
      '/acme/settings/practice',
    );
    expect(screen.getByRole('link', { name: 'Create the invoice' }).getAttribute('href')).toContain(
      '/billing/prepare',
    );
    expect(screen.getByRole('region', { name: 'Before you start' })).toHaveTextContent(
      'Rates before time',
    );
    expect(screen.getByRole('region', { name: 'Who can do what' })).toHaveTextContent('Viewer');
  });

  it('shows the glossary, the shortcuts and where to ask from the tabs', async () => {
    const user = userEvent.setup();
    renderInOrg(<HelpPage />, { route: '/acme/help' });

    await user.click(screen.getByRole('tab', { name: 'Glossary' }));
    const glossary = screen.getByRole('region', { name: 'Glossary' });
    expect(within(glossary).getByText('WIP (work in progress)')).toBeInTheDocument();
    expect(within(glossary).getByText('Engagement')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Shortcuts' }));
    expect(screen.getByText('Ctrl or Cmd + K')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Get help' }));
    expect(screen.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
      'href',
      '/acme/application-testing/tickets?new=1',
    );
  });

  it('opens a tab straight from the address', () => {
    renderInOrg(<HelpPage />, { route: '/acme/help?tab=glossary' });
    expect(screen.getByRole('tab', { name: 'Glossary', selected: true })).toBeInTheDocument();
  });

  it('offers no ticket link to someone who may not raise tickets', async () => {
    const user = userEvent.setup();
    renderInOrg(<HelpPage />, {
      route: '/acme/help?tab=support',
      context: contextWith(OWNER_PERMISSIONS.filter((code) => !code.startsWith('ticket.'))),
    });
    await user.click(screen.getByRole('tab', { name: 'Get help' }));
    expect(screen.queryByRole('link', { name: 'Report a problem' })).not.toBeInTheDocument();
  });
});
