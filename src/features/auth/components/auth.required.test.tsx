import { describe, it } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { expectRequiredFields } from '@/test/requiredFields';

import { EmailRequestForm } from './EmailRequestForm';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ResetPasswordForm } from './ResetPasswordForm';

describe('mandatory fields of the sign-in forms', () => {
  it('marks email and password on the login form', () => {
    renderWithProviders(<LoginForm />);
    expectRequiredFields(document.body, { required: ['Email', 'Password'] });
  });

  it('marks every field of the registration form', () => {
    renderWithProviders(<RegisterForm onRegistered={() => undefined} />);
    expectRequiredFields(document.body, {
      required: ['Full name', 'Work email', 'Password', 'Confirm password'],
    });
  });

  it('marks both passwords of the reset form', () => {
    renderWithProviders(
      <ResetPasswordForm token="t" onDone={() => undefined} onInvalidToken={() => undefined} />,
    );
    expectRequiredFields(document.body, { required: ['New password', 'Confirm new password'] });
  });

  it('marks the email of the forgot-password form', () => {
    renderWithProviders(
      <EmailRequestForm
        submitLabel="Send link"
        onSubmitEmail={() => Promise.resolve()}
        onSent={() => undefined}
      />,
    );
    expectRequiredFields(document.body, { required: ['Email'] });
  });
});
