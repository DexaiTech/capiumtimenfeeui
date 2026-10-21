import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fail, server } from '@/test/server';
import { renderWithProviders } from '@/test/render';

import { PersonAvatar } from './PersonAvatar';

const ID = '0198c1f2-0000-7000-8000-000000000001';
let requests = 0;

beforeEach(() => {
  requests = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:test/picture',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
});
afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('PersonAvatar', () => {
  it('shows the initials and asks for nothing when the person has no picture', () => {
    server.use(
      http.get('*/api/v1/users/:id/avatar', () => {
        requests += 1;
        return new Response('x');
      }),
    );
    renderWithProviders(<PersonAvatar userId={ID} name="Ada Lovelace" pictureVersion={null} />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
    expect(requests).toBe(0);
  });

  it('shows the picture when there is one', async () => {
    server.use(
      http.get('*/api/v1/users/:id/avatar', () => {
        requests += 1;
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'image/png' },
        });
      }),
    );
    renderWithProviders(
      <PersonAvatar userId={ID} name="Ada Lovelace" pictureVersion="2026-10-21T10:00:00Z" />,
    );
    // The initials are an `img` too: wait until the picture has replaced them.
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
        'src',
        'blob:test/picture',
      ),
    );
    expect(requests).toBe(1);
  });

  it('keeps the initials when the picture cannot be loaded', async () => {
    server.use(
      http.get('*/api/v1/users/:id/avatar', () => fail(404, 'NOT_FOUND', 'Picture not found.')),
    );
    renderWithProviders(
      <PersonAvatar userId={ID} name="Ada Lovelace" pictureVersion="2026-10-21T10:00:00Z" />,
    );
    expect(await screen.findByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });
});
