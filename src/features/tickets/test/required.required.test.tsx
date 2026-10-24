import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';

import { CreateTicketPanel } from '../components/list/CreateTicketPanel';

describe('mandatory fields of the ticket forms', () => {
  it('marks the subject and the description of a new ticket, not priority or status', async () => {
    renderInOrg(<CreateTicketPanel open onClose={() => undefined} />);
    const dialog = await screen.findByRole('region', { name: 'Application Testing' });
    expectRequiredFields(dialog, {
      required: ['Subject'],
      optional: ['Priority', 'Status'],
    });
    // The rich text box is labelled by its label text, so the helper cannot pair them by `for`.
    const description = within(dialog).getByRole('textbox', { name: 'Description' });
    expect(description).toHaveAttribute('aria-required', 'true');
    expect(within(dialog).getByText('Description').closest('label')).toHaveClass('field-required');
  });

  it('puts no asterisk into the label text', async () => {
    renderInOrg(<CreateTicketPanel open onClose={() => undefined} />);
    const dialog = await screen.findByRole('region', { name: 'Application Testing' });
    expect(dialog.textContent).not.toContain('*');
  });
});
