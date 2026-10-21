import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { filesOfClipboard, useFileIntake } from './useFileIntake';

const png = (name = 'shot.png') =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });

function Zone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const { dragging, intakeProps } = useFileIntake({ onFiles, disabled: disabled ?? false });
  return (
    <div {...intakeProps} data-testid="zone" data-dragging={String(dragging)}>
      <input aria-label="inside" />
    </div>
  );
}

const clipboard = (files: File[], text = '') => ({
  clipboardData: { files, types: ['Files'], getData: () => text },
});

describe('useFileIntake', () => {
  it('takes the files dropped on the element and highlights it while they are over it', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');

    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'], files: [] } });
    expect(zone).toHaveAttribute('data-dragging', 'true');
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [png()] } });

    expect(zone).toHaveAttribute('data-dragging', 'false');
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('ignores a drag that carries no files (selected text, a link)', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');

    fireEvent.dragEnter(zone, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(zone).toHaveAttribute('data-dragging', 'false');
    fireEvent.drop(zone, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('stays highlighted while the drag moves between its children', () => {
    render(<Zone onFiles={vi.fn()} />);
    const zone = screen.getByTestId('zone');
    const input = screen.getByLabelText('inside');
    const data = { dataTransfer: { types: ['Files'], files: [] } };

    fireEvent.dragEnter(zone, data);
    fireEvent.dragEnter(input, data);
    fireEvent.dragLeave(zone, data);
    expect(zone).toHaveAttribute('data-dragging', 'true');
    fireEvent.dragLeave(input, data);
    expect(zone).toHaveAttribute('data-dragging', 'false');
  });

  it('is focusable, so a paste can be aimed at it, and takes a pasted picture', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const zone = screen.getByTestId('zone');
    expect(zone).toHaveAttribute('tabindex', '0');

    zone.focus();
    fireEvent.paste(zone, clipboard([png('image.png')]));
    expect(onFiles).toHaveBeenCalledOnce();
  });

  it('takes a picture pasted while a field inside it has the focus', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    fireEvent.paste(screen.getByLabelText('inside'), clipboard([png()]));
    expect(onFiles).toHaveBeenCalledOnce();
  });

  it('leaves a paste that carries text to the field', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    fireEvent.paste(screen.getByLabelText('inside'), clipboard([png()], 'A1\tB1'));
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} disabled />);
    const zone = screen.getByTestId('zone');
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'], files: [] } });
    expect(zone).toHaveAttribute('data-dragging', 'false');
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [png()] } });
    fireEvent.paste(zone, clipboard([png()]));
    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('filesOfClipboard', () => {
  it('falls back to the clipboard items when there is no file list', () => {
    const file = png();
    const data = {
      files: [],
      items: [
        { kind: 'string', getAsFile: () => null },
        { kind: 'file', getAsFile: () => file },
      ],
      getData: () => '',
    } as unknown as DataTransfer;
    expect(filesOfClipboard(data)).toEqual([file]);
  });

  it('is empty without a clipboard', () => {
    expect(filesOfClipboard(null)).toEqual([]);
  });
});
