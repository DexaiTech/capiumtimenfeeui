import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { apiPath, fail, ok, server } from '@/test/server';

import { RegisterForm } from './RegisterForm';

interface Values {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

async function fillAndSubmit({ name, email, password, confirm }: Values) {
  const user = userEvent.setup();
  if (name) await user.type(screen.getByLabelText('Full name'), name);
  if (email) await user.type(screen.getByLabelText('Work email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (confirm) await user.type(screen.getByLabelText('Confirm password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterForm', () => {
  it('requires every field', async () => {
    const onRegistered = vi.fn();
    renderWithProviders(<RegisterForm onRegistered={onRegistered} />);

    await fillAndSubmit({});

    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Use at least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Confirm your password')).toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it('rejects a short password and a mismatched confirmation', async () => {
    renderWithProviders(<RegisterForm onRegistered={vi.fn()} />);

    await fillAndSubmit({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'short',
      confirm: 'different',
    });

    expect(await screen.findByText('Use at least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('updates the strength hints while typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm onRegistered={vi.fn()} />);
    const meter = screen.getByRole('progressbar', { name: 'Password strength' });
    expect(meter).toHaveAttribute('aria-valuetext', 'Not entered');

    await user.type(screen.getByLabelText('Password'), 'abc');
    expect(meter).toHaveAttribute('aria-valuetext', 'Too short');
    expect(screen.getByText('At least 10 characters').closest('li')).toHaveTextContent('(not met)');

    await user.type(screen.getByLabelText('Password'), 'DEF-12345678-xyz');
    expect(meter).toHaveAttribute('aria-valuetext', 'Strong');
    expect(screen.getByText('At least 10 characters').closest('li')).toHaveTextContent('(met)');
  });

  it('submits the API field names and reports the registered address', async () => {
    let body: unknown;
    server.use(
      http.post(apiPath('/auth/register'), async ({ request }) => {
        body = await request.json();
        return ok(null, { status: 202, message: 'Check your inbox to verify your email' });
      }),
    );
    const onRegistered = vi.fn();
    renderWithProviders(<RegisterForm onRegistered={onRegistered} />);

    await fillAndSubmit({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Analytical-Engine-1843',
      confirm: 'Analytical-Engine-1843',
    });

    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith('ada@example.com'));
    expect(body).toEqual({
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Analytical-Engine-1843',
      password_confirm: 'Analytical-Engine-1843',
    });
  });

  it('maps a weak-password 422 from the server onto the password field', async () => {
    server.use(
      http.post(apiPath('/auth/register'), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
          details: [
            { field: 'password', code: 'too_common', message: 'This password is too common.' },
          ],
        }),
      ),
    );
    const onRegistered = vi.fn();
    renderWithProviders(<RegisterForm onRegistered={onRegistered} />);

    await fillAndSubmit({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'password1234',
      confirm: 'password1234',
    });

    expect(await screen.findByText('This password is too common.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(onRegistered).not.toHaveBeenCalled();
  });
});
