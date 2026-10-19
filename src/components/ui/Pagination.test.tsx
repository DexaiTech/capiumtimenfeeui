import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('loads the next page from the "Load more" button and reports the count', async () => {
    const onLoadMore = vi.fn();
    render(
      <Pagination hasMore onLoadMore={onLoadMore} count={25} itemLabel={['member', 'members']} />,
    );

    expect(screen.getByText('Showing 25 members')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('is busy and cannot be clicked again while a page is loading', async () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore loading onLoadMore={onLoadMore} />);

    const button = screen.getByRole('button', { name: 'Loading…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('says the list has ended instead of offering more', () => {
    render(
      <Pagination
        hasMore={false}
        onLoadMore={() => undefined}
        count={1}
        itemLabel={['member', 'members']}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 member · End of the list')).toBeInTheDocument();
  });

  it('shows the end label alone when no count is given', () => {
    render(<Pagination hasMore={false} onLoadMore={() => undefined} endLabel="Start of the log" />);
    expect(screen.getByText('Start of the log')).toBeInTheDocument();
  });
});
