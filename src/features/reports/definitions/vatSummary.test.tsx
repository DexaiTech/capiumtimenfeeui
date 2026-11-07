import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import VatSummaryReportPage from '../pages/VatSummaryReportPage';
import type { VatSummaryRow, VatSummaryTotals } from '../types';
import { createBackend, reportsHandlers, runsOf } from '../test/handlers';
import { renderReportPage } from '../test/render';

const PAGE = '/acme/reports/vat-summary';

// £10,000 invoiced at 20% less a £500 credit note, and £1,200 of zero-rated disbursements.
const rows = (): VatSummaryRow[] => [
  {
    vat_rate_id: 'vat-standard',
    name: 'Standard',
    code: 'S',
    rate_bp: 2000,
    invoiced_net: 1_000_000,
    invoiced_vat: 200_000,
    credited_net: 50_000,
    credited_vat: 10_000,
    net: 950_000,
    vat: 190_000,
  },
  {
    vat_rate_id: 'vat-zero',
    name: 'Zero rated',
    code: 'Z',
    rate_bp: 0,
    invoiced_net: 120_000,
    invoiced_vat: 0,
    credited_net: 0,
    credited_vat: 0,
    net: 120_000,
    vat: 0,
  },
];

const totals = (): VatSummaryTotals => ({
  invoiced_net: 1_120_000,
  invoiced_vat: 200_000,
  credited_net: 50_000,
  credited_vat: 10_000,
  net: 1_070_000,
  vat: 190_000,
});

function setup(permissions: string[] = OWNER_PERMISSIONS, route = PAGE) {
  const backend = createBackend({ reports: { 'vat-summary': { rows: rows(), totals: totals() } } });
  server.use(...reportsHandlers(backend));
  renderReportPage(<VatSummaryReportPage />, { permissions, route, path: PAGE });
  return backend;
}

const table = async () => {
  const element = await screen.findByRole('table', { name: 'VAT Summary' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('VAT Summary', () => {
  it('shows output VAT by rate, invoices less credit notes', async () => {
    setup();
    const body = within(await table())
      .getAllByRole('row')
      .slice(1);
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveTextContent('Standard');
    expect(body[0]).toHaveTextContent('20%');
    expect(body[0]).toHaveTextContent('£10,000.00');
    expect(body[0]).toHaveTextContent('£1,900.00');
    expect(body[1]).toHaveTextContent('Zero rated');
    expect(body[1]).toHaveTextContent('0%');

    const figures = screen.getByLabelText('VAT Summary figures');
    expect(figures).toHaveTextContent('Output VAT£1,900.00');
    expect(figures).toHaveTextContent('Net sales£10,700.00');
    expect(screen.getByText(/Invoice basis/)).toBeInTheDocument();
  });

  it('asks the API for the chosen quarter and client', async () => {
    const backend = setup(OWNER_PERMISSIONS, `${PAGE}?from=2026-07-01&to=2026-09-30&client=c-1`);
    await table();
    const run = runsOf(backend, 'vat-summary').at(-1)?.params;
    expect(run?.get('date_from')).toBe('2026-07-01');
    expect(run?.get('date_to')).toBe('2026-09-30');
    expect(run?.get('client_id')).toBe('c-1');
  });

  it('is for those who may see financial reports only', async () => {
    const backend = setup(['organization.read', 'report.read']);
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(runsOf(backend, 'vat-summary')).toHaveLength(0);
  });
});
