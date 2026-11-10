import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { SearchField, type SearchFieldProps } from './SearchField';

function Harness(props: Partial<SearchFieldProps>) {
  const [value, setValue] = useState('');
  return <SearchField label="Search leads" value={value} onChange={setValue} {...props} />;
}

describe('SearchField', () => {
  it('keeps a search within the API limit of 100 characters (R-20)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole('searchbox', { name: 'Search leads' });

    await user.type(box, 'a'.repeat(150));

    expect(box).toHaveAttribute('maxLength', '100');
    expect(box).toHaveValue('a'.repeat(100));
  });

  it('lets a page set its own limit', async () => {
    const user = userEvent.setup();
    render(<Harness maxLength={20} />);
    const box = screen.getByRole('searchbox', { name: 'Search leads' });

    await user.type(box, 'b'.repeat(30));

    expect(box).toHaveValue('b'.repeat(20));
  });
});
