import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';

import { ClientsLeadsSwitch } from './ClientsLeadsSwitch';

const tabs = () => screen.getByRole('navigation', { name: 'Clients and leads' });

// Raj, 7 Nov 2026: opening Leads hid Clients. The Client List and Leads both carry these tabs.
describe('ClientsLeadsSwitch', () => {
  it('on the Client List: Clients is marked, Leads is a link', () => {
    renderInOrg(<ClientsLeadsSwitch current="clients" clientCount={13} />);
    expect(within(tabs()).getByText('Clients').closest('[aria-current]')).toHaveTextContent('13');
    expect(within(tabs()).getByRole('link', { name: 'Leads' })).toHaveAttribute(
      'href',
      '/acme/clients/leads',
    );
    expect(within(tabs()).queryByRole('link', { name: /^Clients/ })).not.toBeInTheDocument();
  });

  it('on Leads: Leads is marked, Clients is a link back to the list', () => {
    renderInOrg(<ClientsLeadsSwitch current="leads" clientCount={13} leadCount={8} />);
    expect(within(tabs()).getByText('Leads').closest('[aria-current]')).toHaveTextContent('8');
    expect(within(tabs()).getByRole('link', { name: /^Clients/ })).toHaveAttribute(
      'href',
      '/acme/clients',
    );
  });

  it('shows a dash while a count is loading', () => {
    renderInOrg(<ClientsLeadsSwitch current="clients" clientCount={null} />);
    expect(within(tabs()).getByText('Clients').closest('[aria-current]')).toHaveTextContent('–');
  });
});
