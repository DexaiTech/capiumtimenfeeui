import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AvatarStack } from './AvatarStack';

const people = [
  { id: '1', name: 'Ada Lovelace' },
  { id: '2', name: 'Grace Hopper' },
  { id: '3', name: 'Linus Torvalds' },
  { id: '4', name: 'Margaret Hamilton' },
  { id: '5', name: 'Alan Turing' },
  { id: '6', name: 'Barbara Liskov' },
];

describe('AvatarStack', () => {
  it('shows every avatar when they fit and names the group', () => {
    render(<AvatarStack users={people.slice(0, 3)} />);
    const group = screen.getByRole('group', {
      name: 'Ada Lovelace, Grace Hopper and Linus Torvalds',
    });
    expect(
      within(group)
        .getAllByRole('img')
        .map((image) => image.getAttribute('aria-label')),
    ).toEqual(['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds']);
    expect(within(group).queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('collapses the rest into "+N" beyond max', () => {
    render(<AvatarStack users={people} max={4} />);
    const group = screen.getByRole('group');
    expect(within(group).getAllByRole('img')).toHaveLength(4);
    expect(within(group).getByText('+2')).toBeInTheDocument();
    expect(within(group).getByText('and 2 more')).toBeInTheDocument();
    expect(within(group).getByTitle('Alan Turing and Barbara Liskov')).toBeInTheDocument();
  });

  it('defaults to four avatars and always shows at least one', () => {
    const { rerender } = render(<AvatarStack users={people} />);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    rerender(<AvatarStack users={people} max={0} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('uses the given label and the image when there is one', () => {
    render(
      <AvatarStack
        users={[{ name: 'Ada Lovelace', src: 'https://example.com/a.png' }]}
        label="Watching: Ada"
        size="md"
      />,
    );
    expect(screen.getByRole('group', { name: 'Watching: Ada' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
      'src',
      'https://example.com/a.png',
    );
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<AvatarStack users={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
