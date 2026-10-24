import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox';
import { DateField } from './DateField';
import { Input } from './Input';
import { RichTextEditor } from './RichTextEditor';
import { Select } from './Select';
import { Textarea } from './Textarea';

const labelOf = (control: HTMLElement) => document.querySelector(`label[for="${control.id}"]`);

describe('required fields', () => {
  it('marks an input: a star class on the label and aria-required, not the native attribute', () => {
    render(<Input label="Full name" required />);
    const input = screen.getByRole('textbox', { name: 'Full name' });
    expect(labelOf(input)).toHaveClass('field-required');
    expect(input).toHaveAttribute('aria-required', 'true');
    // The browser's own validation stays off: the forms validate themselves.
    expect(input).not.toHaveAttribute('required');
    // The star is drawn by CSS, so the label's text is exactly what was written.
    expect(screen.getByLabelText('Full name')).toBe(input);
    expect(labelOf(input)?.textContent).toBe('Full name');
  });

  it('leaves an optional field alone', () => {
    render(<Input label="Job title" />);
    const input = screen.getByRole('textbox', { name: 'Job title' });
    expect(labelOf(input)).not.toHaveClass('field-required');
    expect(input).not.toHaveAttribute('aria-required');
  });

  it('marks a select, a textarea, a date field and a checkbox', () => {
    render(
      <>
        <Select label="Grade" options={[{ value: 'a', label: 'A' }]} required />
        <Textarea label="Reason" required />
        <DateField label="Start date" value={null} onChange={() => undefined} required />
        <Checkbox label="I accept" required />
      </>,
    );
    for (const [role, name] of [
      ['combobox', 'Grade'],
      ['textbox', 'Reason'],
      ['checkbox', 'I accept'],
    ] as const) {
      expect(screen.getByRole(role, { name })).toHaveAttribute('aria-required', 'true');
    }
    expect(labelOf(screen.getByRole('combobox', { name: 'Grade' }))).toHaveClass('field-required');
    expect(labelOf(screen.getByRole('textbox', { name: 'Reason' }))).toHaveClass('field-required');
    const date = screen.getByLabelText('Start date');
    expect(date).toHaveAttribute('aria-required', 'true');
    expect(labelOf(date)).toHaveClass('field-required');
    expect(screen.getByText('I accept')).toHaveClass('field-required');
  });

  it('marks a rich text box', async () => {
    render(<RichTextEditor label="Description" required value="" onChange={() => undefined} />);
    const box = await screen.findByRole('textbox', { name: 'Description' });
    expect(box).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('Description').closest('label')).toHaveClass('field-required');
  });
});
