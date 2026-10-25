import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FormSection } from './FormSection';

describe('FormSection', () => {
  it('titles a group of fields', () => {
    render(
      <FormSection title="Contact" description="How to reach them">
        <input aria-label="Email" />
      </FormSection>,
    );
    expect(screen.getByRole('region', { name: 'Contact' })).toHaveTextContent('How to reach them');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('folds an optional group away and opens it on request', async () => {
    const user = userEvent.setup();
    render(
      <FormSection title="Notes" collapsible defaultOpen={false}>
        <input aria-label="Notes field" />
      </FormSection>,
    );
    const details = screen.getByText('Notes').closest('details');
    expect(details).not.toHaveAttribute('open');
    await user.click(screen.getByText('Notes'));
    expect(details).toHaveAttribute('open');
  });

  it('opens a folded group when an error inside it needs to be seen', () => {
    render(
      <FormSection title="Numbers" collapsible defaultOpen={false} forceOpen>
        <input aria-label="UTR" />
      </FormSection>,
    );
    expect(screen.getByText('Numbers').closest('details')).toHaveAttribute('open');
  });
});
