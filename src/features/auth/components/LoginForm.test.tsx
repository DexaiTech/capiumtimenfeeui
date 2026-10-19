import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { tokenStore } from '@/services/api';
import { testAuth } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { apiPath, fail, ok, server } from '@/test/server';

import { LoginForm } from './LoginForm';

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm', () => {
  it('shows validation errors and does not call the API for empty fields', async () => {
    const login = vi.fn(() => ok(testAuth));
    server.use(http.post(apiPath('/auth/login'), login));
    renderWithProviders(<LoginForm />);

    await fillAndSubmit('', '');

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address');
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address', async () => {
    renderWithProviders(<LoginForm />);
    await fillAndSubmit('not-an-email', 'secret-password');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('maps 422 details onto the fields and focuses the first one', async () => {
    server.use(
      http.post(apiPath('/auth/login'), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
          details: [
            { field: 'email', code: 'invalid', message: 'This address cannot be used.' },
            { field: 'password', code: 'too_long', message: 'Must be at most 128 characters.' },
            { field: 'captcha', code: 'required', message: 'Complete the challenge.' },
          ],
        }),
      ),
    );
    renderWithProviders(<LoginForm />);

    await fillAndSubmit('ada@example.com', 'secret-password');

    expect(await screen.findByText('This address cannot be used.')).toBeInTheDocument();
    expect(screen.getByText('Must be at most 128 characters.')).toBeInTheDocument();
    // An entry that matches no field becomes a form-level error.
    expect(screen.getByText('Complete the challenge.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    // The typed values are kept.
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('secret-password');
  });

  it('shows invalid credentials as an inline form error', async () => {
    server.use(
      http.post(apiPath('/auth/login'), () =>
        fail(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.'),
      ),
    );
    renderWithProviders(<LoginForm />);

    await fillAndSubmit('ada@example.com', 'wrong-password');

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  it('reports a rate limit with the wait time and disables the submit button', async () => {
    server.use(
      http.post(apiPath('/auth/login'), () =>
        fail(429, 'RATE_LIMITED', 'Too many requests.', { headers: { 'Retry-After': '30' } }),
      ),
    );
    renderWithProviders(<LoginForm />);

    await fillAndSubmit('ada@example.com', 'secret-password');

    expect(
      await screen.findByText(/Too many attempts\. Try again in 30 seconds\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('stores the access token in memory on success', async () => {
    let body: unknown;
    server.use(
      http.post(apiPath('/auth/login'), async ({ request }) => {
        body = await request.json();
        return ok(testAuth);
      }),
    );
    renderWithProviders(<LoginForm />);

    await fillAndSubmit('  ada@example.com ', 'secret-password');

    await waitFor(() => expect(tokenStore.get()).toBe('access-token-1'));
    expect(body).toEqual({ email: 'ada@example.com', password: 'secret-password' });
    expect(await screen.findByText('Welcome back, Ada Lovelace')).toBeInTheDocument();
  });
});
