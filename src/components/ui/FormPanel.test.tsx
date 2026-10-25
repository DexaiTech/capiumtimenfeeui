import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { FormPanel } from './FormPanel';

function Harness({
  onClose = () => undefined,
  onSubmit = () => undefined,
}: {
  onClose?: () => void;
  onSubmit?: () => void;
}) {
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label>
            Name
            <input />
          </label>
          <button type="submit">Save</button>
        </form>
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

  it('asks before discarding what was typed, and closes at once when nothing was', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Name'), 'Audit');
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Discard what you typed?');

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Audit');

    await user.click(screen.getByRole('button', { name: 'Close New project' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'New project' })).not.toBeInTheDocument();
  });

  it('saves with Ctrl+Enter from a field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Name'), 'Audit');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('gives the focus back to the button that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'New project' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Close New project' }));
    expect(opener).toHaveFocus();
  });
});
