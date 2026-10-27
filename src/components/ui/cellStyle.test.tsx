import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';
import { styleCell, toneOfText } from './cellStyle';

const show = (header: string, content: Parameters<typeof styleCell>[1]) =>
  render(<div>{styleCell(header, content)}</div>);

describe('toneOfText', () => {
  it('gives a word its meaning, and anything else a steady colour', () => {
    expect(toneOfText('Paid')).toBe('green');
    expect(toneOfText('Overdue')).toBe('red');
    expect(toneOfText('Draft')).toBe('amber');
    expect(toneOfText('Submitted')).toBe('blue');
    expect(toneOfText('None')).toBe('grey');
    expect(toneOfText('Bookkeeping')).toBe(toneOfText('Bookkeeping'));
  });
});

describe('styleCell', () => {
  it('draws plain text in a status column as a coloured pill', () => {
    show('Status', 'Overdue');
    expect(screen.getByText('Overdue').className).toContain('bg-badge-red-soft');
  });

  it('does the same for a bare span around the text', () => {
    show('Priority', <span className="text-text">High</span>);
    expect(screen.getByText('High').className).toContain('bg-badge-amber-soft');
  });

  it('gives the people columns a coloured avatar next to the name', () => {
    show('Manager', 'Ada Lovelace');
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('draws a client as the Clients grid does: avatar and strong upper-case name', () => {
    show('Client', 'Techwave Innovations');
    expect(screen.getByRole('img', { name: 'Techwave Innovations' })).toBeInTheDocument();
    expect(screen.getByText('Techwave Innovations').className).toContain('uppercase');
  });

  it('does not turn a count in a people column into an avatar', () => {
    show('Staff', 3);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('colours WIP and ageing figures by what they are', () => {
    show('Time WIP', '£120.00');
    expect(screen.getByText('£120.00').className).toContain('text-info');
    show('Over 90 days', '£50.00 (10%)');
    expect(screen.getByText('£50.00 (10%)').className).toContain('text-danger');
    show('Adjustment', '-£20.00');
    expect(screen.getByText('-£20.00').className).toContain('text-danger');
  });

  it('colours the money that is owed, earned or the total, but not zero', () => {
    const owed = show('Balance', '£1,250.00');
    expect(screen.getByText('£1,250.00').className).toContain('text-danger');
    owed.unmount();
    const paid = show('Paid', '£90.00');
    expect(screen.getByText('£90.00').className).toContain('text-success');
    paid.unmount();
    show('Balance', '£0.00');
    expect(screen.getByText('£0.00').className).not.toContain('text-danger');
  });

  it('leaves what a column already draws, and other columns, as they are', () => {
    show('Status', <Badge tone="blue">Sent</Badge>);
    expect(screen.getByText('Sent').className).toContain('bg-badge-blue-soft');
    show('Description', 'Overdue');
    expect(screen.getByText('Overdue').className).not.toContain('bg-badge');
  });

  it('leaves numbers, dashes and long text in a category column alone', () => {
    show('Type', '12');
    show('Type', '—');
    expect(screen.getByText('12').className).not.toContain('bg-badge');
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
