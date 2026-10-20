import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockOrganizations, ownerContext } from '@/test/orgFixtures';
import { renderApp, resetAppStores } from '@/test/renderApp';
import { testAuth, testUser } from '@/test/fixtures';
import { apiPath, fail, ok, server } from '@/test/server';

// The Clients page is built and tested in its feature; these tests only need to land on it.
vi.mock('@/features/clients/pages/ClientsPage', () => ({ default: () => <h1>Clients</h1> }));

beforeEach(() => {
  resetAppStores();
  mockOrganizations([ownerContext]);
});

const temporaryUser = { ...testUser, must_change_password: true };
const NEW_PASSWORD = 'A-brand-new-passphrase-9';

async function fillForm(user: ReturnType<typeof userEvent.setup>, current = 'Temp-Passw0rd-xyz') {
  await user.type(await screen.findByLabelText('Temporary password'), current);
  await user.type(screen.getByLabelText('New password'), NEW_PASSWORD);
  await user.type(screen.getByLabelText('Confirm new password'), NEW_PASSWORD);
}

describe('a temporary password', () => {
  it('sends every route to the "Choose a new password" screen', async () => {
    const { router } = renderApp('/acme/clients', { user: temporaryUser });

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/change-password');
    // Nothing of the application around it.
    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it.each(['/app', '/acme/account', '/acme/settings/practice'])('also catches %s', async (path) => {
    const { router } = renderApp(path, { user: temporaryUser });
    await screen.findByRole('heading', { name: 'Choose a new password' });
    expect(router.state.location.pathname).toBe('/change-password');
  });

  it('asks for the temporary password, the new one and its confirmation, then continues where the person was going', async () => {
    let body: unknown;
    let changed = false;
    const { router } = renderApp('/acme/clients', { user: temporaryUser });
    // Registered after the render helper's own, so it wins: once the password has changed, the
    // silent refresh returns the person without the flag.
    server.use(
      http.post(apiPath('/users/me/password'), async ({ request }) => {
        body = await request.json();
        changed = true;
        return ok(null);
      }),
      http.post(apiPath('/auth/refresh'), () =>
        ok({ ...testAuth, user: changed ? testUser : temporaryUser }),
      ),
    );
    const user = userEvent.setup();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/clients'));
    expect(body).toMatchObject({
      current_password: 'Temp-Passw0rd-xyz',
      password: NEW_PASSWORD,
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
  });

  it('puts a wrong temporary password on its field', async () => {
    server.use(
      http.post(apiPath('/users/me/password'), () =>
        fail(400, 'AUTH_INVALID_CREDENTIALS', 'The current password is incorrect.'),
      ),
    );
    const { router } = renderApp('/acme/clients', { user: temporaryUser });
    const user = userEvent.setup();

    await fillForm(user, 'Not-the-one-123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('The current password is incorrect.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/change-password');
  });

  it('does not let the two new passwords differ', async () => {
    renderApp('/acme/clients', { user: temporaryUser });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Temporary password'), 'Temp-Passw0rd-xyz');
    await user.type(screen.getByLabelText('New password'), NEW_PASSWORD);
    await user.type(screen.getByLabelText('Confirm new password'), `${NEW_PASSWORD}x`);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('signs out from the screen', async () => {
    const { router } = renderApp('/acme/clients', { user: temporaryUser });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('the screen without a temporary password', () => {
  it('leads an ordinary signed-in person on to the application', async () => {
    const { router } = renderApp('/change-password');
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/dashboard/overview'));
  });

  it('asks an anonymous visitor to sign in', async () => {
    const { router } = renderApp('/change-password', { user: null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('403 PASSWORD_CHANGE_REQUIRED from any request', () => {
  it('sends the person to the screen, whatever page they were on', async () => {
    // The API refuses every request of such an account: the practice list (which the by-slug
    // lookup now shares) as well as the lookup itself.
    const refuse = () => fail(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your password to continue.');
    server.use(
      http.get(apiPath('/users/me/organizations'), refuse),
      http.get(apiPath('/organizations/by-slug/:slug'), refuse),
    );
    const { router } = renderApp('/acme/clients');

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/change-password');
  });
});
