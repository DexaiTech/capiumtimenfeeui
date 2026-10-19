import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrgPreferenceStore } from '@/app/store';
import { memberContext, mockOrganizations, ownerContext } from '@/test/orgFixtures';
import { renderApp, resetAppStores } from '@/test/renderApp';
import { apiPath, fail, ok, server } from '@/test/server';
import { mockClosedDeployment } from '@/test/systemFixtures';

// The pages are built and tested in their features; these tests only need to land on them.
vi.mock('@/features/clients/pages/ClientsPage', () => ({ default: () => <h1>Clients</h1> }));
vi.mock('@/features/dashboard/pages/DashboardOverviewPage', () => ({
  default: () => <h1>Dashboard</h1>,
}));

const DASHBOARD = '/acme/dashboard/overview';

beforeEach(resetAppStores);

describe('the root address', () => {
  it('asks an anonymous visitor to sign in', async () => {
    const { router } = renderApp('/', { user: null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('leads a signed-in person to the practice in a closed deployment', async () => {
    mockClosedDeployment();
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/');
    await waitFor(() => expect(router.state.location.pathname).toBe(DASHBOARD));
  });
});

describe('the sign-in page', () => {
  it('offers to create an account in an open deployment', async () => {
    renderApp('/login', { user: null });
    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('has no register link in a closed deployment and says who creates accounts', async () => {
    mockClosedDeployment();
    renderApp('/login', { user: null });

    expect(await screen.findByText(/Accounts are created by your administrator/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
    // The administrator resets passwords: there is no self-service link.
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument();
  });

  it('keeps the forgot password link in an open deployment', async () => {
    renderApp('/login', { user: null });
    expect(await screen.findByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('does not show the register link while the deployment mode is still unknown', async () => {
    server.use(
      http.get(apiPath('/system'), async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return ok({ closed_deployment: true, organization: { name: 'Acme Inc', slug: 'acme' } });
      }),
    );
    renderApp('/login', { user: null });

    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
    expect(
      await screen.findByText(/Accounts are created by your administrator/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
  });

  it('sends forgot password to the sign-in page in a closed deployment, saying the administrator resets passwords', async () => {
    mockClosedDeployment();
    const { router } = renderApp('/forgot-password', { user: null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByText(/Passwords are reset by your administrator/)).toBeVisible();
  });

  it('still serves the emailed link for choosing a password in a closed deployment', async () => {
    mockClosedDeployment();
    const { router } = renderApp('/reset-password?token=abc', { user: null });
    // Not turned away to the sign-in page: the page waits for the new password.
    expect(await screen.findByLabelText('New password')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/reset-password');
  });

  it('still serves forgot password in an open deployment', async () => {
    const { router } = renderApp('/forgot-password', { user: null });
    expect(await screen.findByRole('heading', { name: /forgot/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/forgot-password');
  });
});

describe('the sign-in page while the API is down', () => {
  it('offers neither sign-up nor password reset when the system information cannot be loaded', async () => {
    server.use(http.get(apiPath('/system'), () => fail(502, 'BAD_GATEWAY', 'Bad Gateway')));
    renderApp('/login', { user: null });

    await screen.findByRole('button', { name: 'Sign in' });
    expect(await screen.findByText(/Accounts are created by your administrator/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument();
  });
});

describe('routes that only exist while sign-up is open', () => {
  it.each(['/register', '/onboarding'])(
    'sends %s to the sign-in page with a calm note in a closed deployment',
    async (path) => {
      mockClosedDeployment();
      const { router } = renderApp(path, { user: null });

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(
        await screen.findByText(/Accounts here are created by your administrator/),
      ).toBeInTheDocument();
    },
  );

  it('sends a signed-in person away from onboarding too', async () => {
    mockClosedDeployment();
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/onboarding');
    await waitFor(() => expect(router.state.location.pathname).toBe(DASHBOARD));
  });

  it('still serves registration in an open deployment', async () => {
    const { router } = renderApp('/register', { user: null });
    expect(await screen.findByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register');
  });
});

describe('after sign-in in a closed deployment', () => {
  it('goes straight to the single practice named by the system information', async () => {
    mockClosedDeployment();
    mockOrganizations([ownerContext, memberContext]);
    // The memory of an earlier practice does not matter: there is only one.
    useOrgPreferenceStore.setState({ lastOrgSlug: 'globex' });
    const { router } = renderApp('/app');

    await waitFor(() => expect(router.state.location.pathname).toBe(DASHBOARD));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('names the practice without offering to switch or create one', async () => {
    mockClosedDeployment();
    mockOrganizations([ownerContext, memberContext]);
    renderApp('/acme/clients');
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Clients' });
    await user.click(screen.getByRole('button', { name: 'Practice: Acme Accountants' }));
    expect(screen.getByRole('menu')).toHaveTextContent('Super admin');
    // Practice settings is still there: only switching and creating are left out.
    expect(screen.getByRole('menuitem', { name: 'Practice settings' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Globex Tax' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Create practice' })).not.toBeInTheDocument();
  });

  it('offers switching and creating a practice in an open deployment', async () => {
    mockOrganizations([ownerContext, memberContext]);
    const { router } = renderApp('/acme/clients');
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Clients' });
    await user.click(screen.getByRole('button', { name: 'Practice: Acme Accountants' }));
    expect(screen.getByRole('menuitem', { name: 'Create practice' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Globex Tax' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/globex/dashboard/overview'));
  });
});
