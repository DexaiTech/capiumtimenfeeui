import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('renders a button of type "button" by default and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is busy, disabled and not clickable while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick} leftIcon={<span data-testid="left-icon" />}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    // The spinner replaces the left icon.
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });

    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is operable from the keyboard and forwards its ref', async () => {
    const onClick = vi.fn();
    let node: HTMLButtonElement | null = null;
    render(
      <Button
        onClick={onClick}
        ref={(element) => {
          node = element;
        }}
      >
        Go
      </Button>,
    );
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Go' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(node).toBe(screen.getByRole('button', { name: 'Go' }));
  });

  describe('compactLabel', () => {
    it('keeps the label as the accessible name and the tooltip, in a span that can hide', () => {
      render(
        <Button compactLabel leftIcon={<svg data-testid="left-icon" />}>
          Export
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Export' });

      expect(button).toHaveAttribute('title', 'Export');
      expect(button.className).toContain('@max-6xl/toolbar:px-1.5');
      const label = screen.getByText('Export');
      expect(label.tagName).toBe('SPAN');
      expect(label.className).toBe('@max-6xl/toolbar:sr-only');
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('lets an explicit title win', () => {
      render(
        <>
          <Button compactLabel title="Exporting reports needs the export permission">
            Export
          </Button>
          <Button compactLabel title={undefined}>
            Export CSV
          </Button>
        </>,
      );

      expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute(
        'title',
        'Exporting reports needs the export permission',
      );
      expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveAttribute(
        'title',
        'Export CSV',
      );
    });

    it('leaves the button unchanged without the prop', () => {
      render(<Button>Export</Button>);
      const button = screen.getByRole('button', { name: 'Export' });

      expect(button).not.toHaveAttribute('title');
      expect(button.querySelector('span')).toBeNull();
      expect(button.className).not.toContain('@max-6xl/toolbar');
    });
  });
});
