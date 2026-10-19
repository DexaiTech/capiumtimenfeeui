import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { ToastProvider } from './Toast';
import { useToast, type ToastOptions } from './toastContext';

function Trigger({ options }: { options: ToastOptions }) {
  const { toast } = useToast();
  return <Button onClick={() => toast(options)}>Notify</Button>;
}

function renderToast(options: ToastOptions) {
  return render(
    <MotionConfig reducedMotion="always">
      <ToastProvider>
        <Trigger options={options} />
      </ToastProvider>
    </MotionConfig>,
  );
}

describe('Toast', () => {
  it('announces a toast politely with its title and description', async () => {
    renderToast({
      tone: 'success',
      title: 'Profile updated',
      description: 'Your changes are saved.',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Notify' }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Profile updated');
    expect(toast).toHaveTextContent('Your changes are saved.');
  });

  it('announces errors assertively', async () => {
    renderToast({ tone: 'error', title: 'Could not reach the server' });
    await userEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('can be dismissed and runs its action', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderToast({ title: 'Item archived', action: { label: 'Undo', onClick }, duration: 0 });
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await screen.findByText('Item archived');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Item archived')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await screen.findByText('Item archived');
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    await waitFor(() => expect(screen.queryByText('Item archived')).not.toBeInTheDocument());
  });

  it('closes itself after its duration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderToast({ title: 'Saved', duration: 1000 });
      await userEvent
        .setup({ advanceTimers: vi.advanceTimersByTime })
        .click(screen.getByRole('button', { name: 'Notify' }));
      expect(await screen.findByText('Saved')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1100);
      });
      await waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws a helpful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger options={{ title: 'x' }} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
