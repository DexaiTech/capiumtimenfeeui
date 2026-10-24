import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it } from 'vitest';

import { testOrganization } from '@/test/orgFixtures';
import { renderWithProviders } from '@/test/render';
import { expectRequiredFields } from '@/test/requiredFields';

import { CreateOrganizationForm } from './CreateOrganizationForm';
import { DeleteOrganization } from './DeleteOrganization';

describe('mandatory fields of the practice forms', () => {
  it('marks the practice name on the create form, not the optional URL name', () => {
    renderWithProviders(<CreateOrganizationForm onCreated={() => undefined} />);
    expectRequiredFields(document.body, {
      required: ['Practice name'],
      optional: ['URL name (optional)'],
    });
  });

  it('marks the confirmation field of the delete dialog', async () => {
    renderWithProviders(<DeleteOrganization organization={testOrganization} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete practice' }));
    expectRequiredFields(await screen.findByRole('dialog'), { required: [/to confirm/] });
  });
});
