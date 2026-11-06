import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reloadForNewVersion } from '@/utils/reloadForNewVersion';

import { RouteErrorPage } from './RouteErrorPage';

vi.mock('@/utils/reloadForNewVersion', () => ({ reloadForNewVersion: vi.fn() }));
const reload = vi.mocked(reloadForNewVersion);

/** A page whose code file fails to download, like a page of an older release (APT82). */
function renderFailingPage(error: Error) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        lazy: () => Promise.reject(error),
        errorElement: <RouteErrorPage fullPage />,
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

const chunkError = () =>
  new TypeError('Failed to fetch dynamically imported module: /assets/WipSummaryPage-OLD.js');

describe('RouteErrorPage when a page file is missing (APT82)', () => {
  beforeEach(() => reload.mockReset());

  it('reloads for the new version instead of showing the error', async () => {
    reload.mockReturnValue(true);
    renderFailingPage(chunkError());
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('This page could not be loaded')).not.toBeInTheDocument();
  });

  it('shows the message when no reload happens (offline, or it already reloaded)', async () => {
    reload.mockReturnValue(false);
    renderFailingPage(chunkError());
    expect(await screen.findByText('This page could not be loaded')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A new version may have been released, or your connection dropped. Reload to continue.',
      ),
    ).toBeInTheDocument();
  });

  it('leaves other errors as they were: no automatic reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderFailingPage(new Error('Cannot read properties of undefined'));
    expect(await screen.findByText('Something went wrong on this page')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
