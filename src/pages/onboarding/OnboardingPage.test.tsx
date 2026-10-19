import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrgPreferenceStore } from '@/app/store';
import { mockOrganizations, ownerContext } from '@/test/orgFixtures';
import { renderApp, resetAppStores } from '@/test/renderApp';
import { apiPath, fail, ok, server } from '@/test/server';

// The pages are built and tested in their features; these tests only need to land on them.
vi.mock('@/features/dashboard/pages/DashboardOverviewPage', () => ({
  default: () => <h1>Dashboard</h1>,
}));

beforeEach(resetAppStores);

const nameField = () => screen.findByLabelText('Practice name');
const submit = () => screen.getByRole('button', { name: 'Create practice' });

describe('OnboardingPage', () => {
  it('validates the name and the slug without calling the API', async () => {
    mockOrganizations([]);
    const create = vi.fn(() => ok(ownerContext, { status: 201 }));
    server.use(http.post(apiPath('/organizations'), create));
    renderApp('/onboarding');
    const user = userEvent.setup();

    await nameField();
    await user.click(submit());
    expect(await screen.findByText('Enter the practice name')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Practice name'), 'Acme');
    await user.type(screen.getByLabelText('URL name (optional)'), 'Not Valid!');
    await user.click(submit());
    expect(
      await screen.findByText(/Use lowercase letters, numbers and hyphens/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('URL name (optional)')).toHaveAttribute('aria-invalid', 'true');
    expect(create).not.toHaveBeenCalled();
  });

  it('previews the derived slug and the resulting address while typing', async () => {
    mockOrganizations([]);
    renderApp('/onboarding');
    const user = userEvent.setup();

    await user.type(await nameField(), 'Crème Brûlée GmbH');
    expect(screen.getByText(/Leave empty to use “creme-brulee-gmbh”/)).toBeInTheDocument();
    const preview = screen.getByText('Your practice’s address').parentElement;
    expect(preview).toHaveTextContent('localhost:3000/creme-brulee-gmbh');

    // A typed slug takes over the preview.
    await user.type(screen.getByLabelText('URL name (optional)'), 'creme');
    expect(preview).toHaveTextContent(/localhost:3000\/creme$/);
  });

  it("defaults the timezone to the browser's", async () => {
    mockOrganizations([]);
    renderApp('/onboarding');
    await nameField();
    expect(screen.getByLabelText('Timezone')).toHaveValue(
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    );
  });

  it('shows a taken slug on the slug field and keeps what was typed', async () => {
    mockOrganizations([]);
    server.use(
      http.post(apiPath('/organizations'), () =>
        fail(409, 'CONFLICT', 'This URL name is already in use.', {
          details: [{ field: 'slug', message: 'This URL name is already in use.' }],
        }),
      ),
    );
    renderApp('/onboarding');
    const user = userEvent.setup();

    await user.type(await nameField(), 'Acme Inc');
    await user.type(screen.getByLabelText('URL name (optional)'), 'acme');
    await user.click(submit());

    const slug = screen.getByLabelText('URL name (optional)');
    await waitFor(() => expect(slug).toHaveAttribute('aria-invalid', 'true'));
    expect(slug).toHaveAccessibleDescription('This URL name is already in use.');
    expect(slug).toHaveFocus();
    expect(slug).toHaveValue('acme');
    expect(screen.getByLabelText('Practice name')).toHaveValue('Acme Inc');
  });

  it('shows a conflict that is not about the slug as a form error', async () => {
    mockOrganizations([]);
    server.use(
      http.post(apiPath('/organizations'), () =>
        fail(409, 'CONFLICT', 'You can own at most 10 practices.'),
      ),
    );
    renderApp('/onboarding');
    const user = userEvent.setup();

    await user.type(await nameField(), 'Acme Inc');
    await user.click(submit());
    expect(await screen.findByText('You can own at most 10 practices.')).toBeInTheDocument();
    expect(screen.getByLabelText('URL name (optional)')).not.toHaveAttribute('aria-invalid');
  });

  it('maps 422 details onto the fields', async () => {
    mockOrganizations([]);
    server.use(
      http.post(apiPath('/organizations'), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
          details: [{ field: 'name', message: 'This name cannot be used.' }],
        }),
      ),
    );
    renderApp('/onboarding');
    const user = userEvent.setup();

    await user.type(await nameField(), 'Acme Inc');
    await user.click(submit());
    expect(await screen.findByText('This name cannot be used.')).toBeInTheDocument();
    expect(screen.getByLabelText('Practice name')).toHaveFocus();
  });

  it('creates the practice and opens it', async () => {
    let body: unknown;
    mockOrganizations([ownerContext]);
    server.use(
      // Before creation the user has no practice.
      http.get(apiPath('/users/me/organizations'), () => ok([]), { once: true }),
      http.post(apiPath('/organizations'), async ({ request }) => {
        body = await request.json();
        return ok(ownerContext, { status: 201 });
      }),
    );
    const { router } = renderApp('/onboarding');
    const user = userEvent.setup();

    await user.type(await nameField(), '  Acme Inc ');
    await user.click(submit());

    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/dashboard/overview'));
    // No slug was typed, so none is sent and the API derives one.
    expect(body).toEqual({
      name: 'Acme Inc',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(useOrgPreferenceStore.getState().lastOrgSlug).toBe('acme');
  });
});
