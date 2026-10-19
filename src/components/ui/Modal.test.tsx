import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { Modal } from './Modal';

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <MotionConfig reducedMotion="always">
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Modal
        open={open}
        onClose={close}
        title="Delete project?"
        description="This cannot be undone."
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="danger">Delete</Button>
          </>
        }
      />
    </MotionConfig>
  );
}

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a labelled, described modal dialog and moves focus inside', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete project?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = await screen.findByRole('dialog');

    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(deleteButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    for (let step = 0; step < 5; step += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('closes on Escape and returns focus to the element that opened it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
  it('cannot be dismissed when it is not dismissible: no close button, Escape or backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MotionConfig reducedMotion="always">
        <Modal open onClose={onClose} dismissible={false} title="Required step">
          <Button>Continue</Button>
        </Modal>
      </MotionConfig>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Required step' });
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    // The backdrop is the dialog's decorative sibling.
    const backdrop = dialog.previousElementSibling;
    if (backdrop instanceof HTMLElement) await user.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Required step' })).toBeInTheDocument();
  });
});
