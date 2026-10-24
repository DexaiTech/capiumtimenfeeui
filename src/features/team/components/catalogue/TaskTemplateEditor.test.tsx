import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { expectRequiredFields } from '@/test/requiredFields';

import { TaskTemplateEditor } from './TaskTemplateEditor';
import {
  MAX_TEMPLATES,
  newRow,
  toTemplateInputs,
  validateRows,
  type TemplateRow,
} from './taskTemplateRows';

function Harness({
  initial = [],
  showErrors = false,
  onRows,
}: {
  initial?: TemplateRow[];
  showErrors?: boolean;
  onRows?: (rows: TemplateRow[]) => void;
}) {
  const [rows, setRows] = useState(initial);
  return (
    <TaskTemplateEditor
      rows={rows}
      showErrors={showErrors}
      onChange={(next) => {
        setRows(next);
        onRows?.(next);
      }}
    />
  );
}

const titled = (...titles: string[]) => titles.map((title) => newRow(title));
const titlesOnScreen = () =>
  screen.queryAllByRole('textbox', { name: 'Title' }).map((box) => (box as HTMLInputElement).value);
const group = (n: number) => screen.getByRole('group', { name: `Default task ${String(n)}` });

describe('TaskTemplateEditor', () => {
  it('starts empty and adds a row with a title, hours, due days and description', async () => {
    const user = userEvent.setup();
    let latest: TemplateRow[] = [];
    render(<Harness onRows={(rows) => (latest = rows)} />);
    expect(screen.getByText('No default tasks yet.')).toBeInTheDocument();
    expect(screen.getByText('0 of 100')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add task' }));
    const first = within(group(1));
    await user.type(first.getByRole('textbox', { name: 'Title' }), 'Request records');
    await user.type(first.getByRole('textbox', { name: 'Hours budget' }), '1:30{Enter}');
    await user.type(first.getByRole('textbox', { name: 'Due (days after the job starts)' }), '14');
    await user.type(first.getByRole('textbox', { name: 'Description' }), 'Chase the client');

    expect(toTemplateInputs(latest)).toEqual([
      {
        title: 'Request records',
        description: 'Chase the client',
        budget_minutes: 90,
        due_offset_days: 14,
      },
    ]);
    expect(screen.getByText('1 of 100')).toBeInTheDocument();
  });

  it('marks the title as required and the other fields as optional', () => {
    render(<Harness initial={titled('Prepare')} />);
    expectRequiredFields(group(1), {
      required: ['Title'],
      optional: ['Hours budget', 'Due (days after the job starts)', 'Description'],
    });
  });

  it('removes a row', async () => {
    const user = userEvent.setup();
    render(<Harness initial={titled('A', 'B', 'C')} />);
    await user.click(screen.getByRole('button', { name: 'Remove task 2' }));
    expect(titlesOnScreen()).toEqual(['A', 'C']);
  });

  it('moves a row up and down, and disables the moves at the ends', async () => {
    const user = userEvent.setup();
    render(<Harness initial={titled('A', 'B', 'C')} />);
    expect(screen.getByRole('button', { name: 'Move task 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move task 3 down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move task 3 up' }));
    expect(titlesOnScreen()).toEqual(['A', 'C', 'B']);
    await user.click(screen.getByRole('button', { name: 'Move task 1 down' }));
    expect(titlesOnScreen()).toEqual(['C', 'A', 'B']);
  });

  it('turns a pasted list into rows, dropping blank lines and list markers', async () => {
    const user = userEvent.setup();
    render(<Harness initial={titled('First')} />);
    await user.click(screen.getByRole('button', { name: 'Paste a list' }));
    await user.click(screen.getByRole('textbox', { name: 'Tasks to add' }));
    await user.paste('- Second\n\n2. Third\n  * Fourth  \n');
    await user.click(screen.getByRole('button', { name: 'Add 3 tasks' }));

    expect(titlesOnScreen()).toEqual(['First', 'Second', 'Third', 'Fourth']);
    // The box closes once the rows are in.
    expect(screen.queryByRole('textbox', { name: 'Tasks to add' })).not.toBeInTheDocument();
  });

  it('asks for at least one line when the pasted list is empty', async () => {
    const user = userEvent.setup();
    render(<Harness initial={titled('First')} />);
    await user.click(screen.getByRole('button', { name: 'Paste a list' }));
    await user.click(screen.getByRole('button', { name: 'Add these tasks' }));
    expect(screen.getByText('Paste at least one line.')).toBeInTheDocument();
    expect(titlesOnScreen()).toEqual(['First']);
  });

  it('stops at 100 rows: no more can be added, and a list that does not fit is refused', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Harness initial={titled(...Array.from({ length: MAX_TEMPLATES - 1 }, (_, i) => `T${i}`))} />,
    );
    await user.click(screen.getByRole('button', { name: 'Paste a list' }));
    await user.click(screen.getByRole('textbox', { name: 'Tasks to add' }));
    await user.paste('One\nTwo');
    await user.click(screen.getByRole('button', { name: 'Add 2 tasks' }));
    expect(screen.getByText(/Only 1 more task fits/)).toBeInTheDocument();
    expect(titlesOnScreen()).toHaveLength(MAX_TEMPLATES - 1);

    await user.clear(screen.getByRole('textbox', { name: 'Tasks to add' }));
    await user.click(screen.getByRole('textbox', { name: 'Tasks to add' }));
    await user.paste('Last');
    await user.click(screen.getByRole('button', { name: 'Add 1 task' }));
    expect(titlesOnScreen()).toHaveLength(MAX_TEMPLATES);
    expect(screen.getByText('100 of 100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Paste a list' })).toBeDisabled();
    unmount();
  });

  it('shows what is wrong with a row only once errors are asked for', () => {
    const rows = [
      { ...newRow(''), due_offset_days: '4000' },
      { ...newRow('x'.repeat(10)), due_offset_days: '1.5' },
    ];
    const { rerender } = render(<TaskTemplateEditor rows={rows} onChange={() => undefined} />);
    expect(screen.queryByText('Enter the task title')).not.toBeInTheDocument();

    rerender(<TaskTemplateEditor rows={rows} onChange={() => undefined} showErrors />);
    expect(screen.getByText('Enter the task title')).toBeInTheDocument();
    expect(screen.getAllByText('Enter a whole number of days from 0 to 3650')).toHaveLength(2);
  });
});

describe('validateRows', () => {
  it('accepts a title alone, and 0 and 3650 days', () => {
    const rows = [
      newRow('A'),
      { ...newRow('B'), due_offset_days: '0' },
      { ...newRow('C'), due_offset_days: '3650' },
    ];
    expect(validateRows(rows)).toEqual([{}, {}, {}]);
  });

  it('refuses a blank or too long title, too many days and a too long description', () => {
    const [blank, long, days, desc] = validateRows([
      newRow('   '),
      newRow('x'.repeat(201)),
      { ...newRow('A'), due_offset_days: '3651' },
      { ...newRow('A'), description: 'x'.repeat(2001) },
    ]);
    expect(blank?.title).toBe('Enter the task title');
    expect(long?.title).toBe('Use at most 200 characters');
    expect(days?.due_offset_days).toBeDefined();
    expect(desc?.description).toBe('Use at most 2000 characters');
  });
});
