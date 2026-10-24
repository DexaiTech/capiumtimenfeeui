import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { FormPanel } from './FormPanel';

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setOpen(true)}>New project</Button>
      <FormPanel
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="New project"
        description="Name the project."
      >
        <label>
          Name
          <input />
        </label>
      </FormPanel>
      <p>The list stays here</p>
    </div>
  );
}

describe('FormPanel', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('region', { name: 'New project' })).not.toBeInTheDocument();
  });

  it('opens in the page, not as a dialog, and leaves the page usable', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'New project' }));
    const panel = screen.getByRole('region', { name: 'New project' });
    expect(panel).toHaveTextContent('Name the project.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('The list stays here')).toBeVisible();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('puts the cursor in the first field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'New project' }));
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('closes from the close button and from Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.click(screen.getByRole('button', { name: 'Close New project' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'New project' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('region', { name: 'New project' })).not.toBeInTheDocument();
  });
});
