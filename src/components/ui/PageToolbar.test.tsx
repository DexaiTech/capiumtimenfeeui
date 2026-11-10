import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageToolbar } from './PageToolbar';

describe('PageToolbar', () => {
  it('renders the slots in order: tabs, search, actions, primary', () => {
    const { container } = render(
      <PageToolbar
        start={<div role="tablist" aria-label="Statuses" />}
        search={<input type="search" aria-label="Search invoices" />}
        actions={<button type="button">Filter</button>}
        primaryAction={<button type="button">Create invoice</button>}
      />,
    );

    const toolbar = container.querySelector('[data-page-toolbar]');
    expect(toolbar).not.toBeNull();
    const order = [
      screen.getByRole('tablist', { name: 'Statuses' }),
      screen.getByRole('searchbox', { name: 'Search invoices' }),
      screen.getByRole('button', { name: 'Filter' }),
      screen.getByRole('button', { name: 'Create invoice' }),
    ];
    for (const [index, element] of order.entries()) {
      expect(toolbar).toContainElement(element);
      const next = order[index + 1];
      if (next) {
        expect(
          element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    }
  });

  it('keeps the actions and the primary button together, apart from the tabs and search', () => {
    render(
      <PageToolbar
        start={<div role="tablist" aria-label="Statuses" />}
        search={<input type="search" aria-label="Search" />}
        actions={<button type="button">Filter</button>}
        primaryAction={<button type="button">New job</button>}
      />,
    );

    const filter = screen.getByRole('button', { name: 'Filter' });
    expect(filter.parentElement).toBe(
      screen.getByRole('button', { name: 'New job' }).parentElement,
    );
    expect(filter.parentElement).not.toContainElement(
      screen.getByRole('searchbox', { name: 'Search' }),
    );
  });
});
