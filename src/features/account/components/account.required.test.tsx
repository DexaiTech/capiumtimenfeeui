import { describe, it } from 'vitest';

import { testUser } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { expectRequiredFields } from '@/test/requiredFields';

import { ChangePasswordForm } from './ChangePasswordForm';
import { ProfileForm } from './ProfileForm';

describe('mandatory fields of the account forms', () => {
  it('marks the full name on the profile form, not the read-only email', () => {
    renderWithProviders(<ProfileForm user={testUser} />);
    expectRequiredFields(document.body, { required: ['Full name'], optional: ['Email'] });
  });

  it('marks all three passwords on the change-password form', () => {
    renderWithProviders(<ChangePasswordForm />);
    expectRequiredFields(document.body, {
      required: ['Current password', 'New password', 'Confirm new password'],
    });
  });
});
