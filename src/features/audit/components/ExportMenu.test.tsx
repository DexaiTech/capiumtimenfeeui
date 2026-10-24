import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, server } from '@/test/server';
import { todayInZone } from '@/utils/dates';

import type { AuditExportFilters } from '../types';
import { AuditExportMenu } from './ExportMenu';

const FILTERS: AuditExportFilters = { action: 'invoice.', target_type: 'invoice', q: 'babbage' };

/** Serves the export and records its queries; stubs the download so the click can be seen. */
function exportEnvironment(response: () => Response = () => new HttpResponse('Time (UTC)\r\n')) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get(orgApiPath('/audit-logs/export'), ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return response();
    }),
  );
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:audit');
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  const clicks: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this);
  });
  return { queries, createObjectURL, clicks };
}

const today = () => todayInZone('Europe/London');

describe('AuditExportMenu', () => {
  it('downloads the CSV of what the list shows', async () => {
    const { queries, createObjectURL, clicks } = exportEnvironment(
      () => new HttpResponse('Time (UTC),User\r\n', { headers: { 'Content-Type': 'text/csv' } }),
    );
    const user = userEvent.setup();
    renderInOrg(<AuditExportMenu filters={FILTERS} />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const menu = screen.getByRole('dialog', { name: 'Export format' });
    await user.click(within(menu).getByRole('button', { name: 'CSV (.csv)' }));

    await waitFor(() => expect(clicks).toHaveLength(1));
    expect(queries[0]?.get('format')).toBe('csv');
    expect(queries[0]?.get('action')).toBe('invoice.');
    expect(queries[0]?.get('target_type')).toBe('invoice');
    expect(queries[0]?.get('q')).toBe('babbage');
    expect(clicks[0]?.download).toBe(`audit-log-${today()}.csv`);
    expect(clicks[0]?.href).toBe('blob:audit');
    expect(await createObjectURL.mock.calls[0]?.[0].text()).toContain('Time (UTC)');
    expect(await screen.findByText('Audit log exported')).toBeInTheDocument();
    expect(screen.getByText(/up to 50,000/)).toBeInTheDocument();
  });

  it('downloads the Excel workbook too', async () => {
    const { queries, clicks } = exportEnvironment();
    const user = userEvent.setup();
    renderInOrg(<AuditExportMenu filters={{}} />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Excel (.xlsx)' }));

    await waitFor(() => expect(clicks).toHaveLength(1));
    // Only the filters that are set are sent.
    expect([...(queries[0]?.keys() ?? [])]).toEqual(['format']);
    expect(queries[0]?.get('format')).toBe('xlsx');
    expect(clicks[0]?.download).toBe(`audit-log-${today()}.xlsx`);
  });

  it('says why the export failed and downloads nothing', async () => {
    const { clicks } = exportEnvironment(() =>
      fail(403, 'PERMISSION_DENIED', 'You do not have permission to do that.'),
    );
    const user = userEvent.setup();
    renderInOrg(<AuditExportMenu filters={FILTERS} />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'CSV (.csv)' }));

    expect(await screen.findByText('Could not export the audit log')).toBeInTheDocument();
    // In the page, not "visible": a toast fades in, and the test must not depend on that timing.
    expect(
      screen.getByText('Your role does not include exporting the audit log.'),
    ).toBeInTheDocument();
    expect(clicks).toHaveLength(0);
    expect(screen.queryByText('Audit log exported')).toBeNull();
  });

  it('quotes the request id of a server failure', async () => {
    exportEnvironment(() => fail(500, 'INTERNAL_ERROR', 'Boom'));
    const user = userEvent.setup();
    renderInOrg(<AuditExportMenu filters={FILTERS} />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Excel (.xlsx)' }));

    expect(await screen.findByText(/Request ID: req-test-123/)).toBeInTheDocument();
  });

  it('is disabled when there is nothing to export, and closes the menu after a choice', async () => {
    exportEnvironment();
    const user = userEvent.setup();
    const view = renderInOrg(<AuditExportMenu filters={FILTERS} disabled />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    view.unmount();

    renderInOrg(<AuditExportMenu filters={FILTERS} />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'CSV (.csv)' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Export format' })).toBeNull());
  });
});
