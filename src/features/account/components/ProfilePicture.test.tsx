import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { testUser } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { fail, ok, readUpload, server } from '@/test/server';
import type { User } from '@/types/models';

import { pictureRefusal } from '../avatar';
import { ProfilePicture } from './ProfilePicture';

const png = (name = 'me.png', bytes = 3) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });
const withPicture: User = { ...testUser, avatar_updated_at: '2026-10-21T10:00:00Z' };

let uploads: string[] = [];
let removals = 0;

beforeEach(() => {
  uploads = [];
  removals = 0;
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
  server.use(
    http.post('*/api/v1/users/me/avatar', async ({ request }) => {
      uploads.push((await readUpload(request)).field);
      return ok({ ...testUser, avatar_updated_at: '2026-10-21T11:00:00Z' });
    }),
    http.delete('*/api/v1/users/me/avatar', () => {
      removals += 1;
      return ok({ ...testUser, avatar_updated_at: null });
    }),
    http.get('*/api/v1/users/:id/avatar', () => new Response(new Uint8Array([1]))),
  );
});
afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

const zone = () => screen.getByLabelText('Profile picture drop zone');
const input = () => screen.getByLabelText('Profile picture file');

describe('pictureRefusal', () => {
  it('accepts the picture types and refuses everything else', () => {
    expect(pictureRefusal({ name: 'a.PNG', size: 10, type: 'image/png' })).toBeNull();
    expect(pictureRefusal({ name: 'a.webp', size: 10, type: '' })).toBeNull();
    expect(pictureRefusal({ name: 'cv.pdf', size: 10, type: 'application/pdf' })).toMatch(/PNG/);
    expect(pictureRefusal({ name: 'a.svg', size: 10, type: 'image/svg+xml' })).toMatch(/PNG/);
    expect(pictureRefusal({ name: 'a.png', size: 0, type: 'image/png' })).toMatch(/empty/);
    expect(pictureRefusal({ name: 'a.png', size: 2_097_153, type: 'image/png' })).toMatch(/2 MB/);
    expect(pictureRefusal({ name: 'a.png', size: 2_097_152, type: 'image/png' })).toBeNull();
  });
});

describe('ProfilePicture', () => {
  it('uploads the picture that was chosen', async () => {
    renderWithProviders(<ProfilePicture user={testUser} />);
    fireEvent.change(input(), { target: { files: [png()] } });
    await waitFor(() => expect(uploads).toEqual(['file']));
    expect(await screen.findByText('Profile picture updated')).toBeInTheDocument();
  });

  it('uploads a picture dropped on the zone', async () => {
    renderWithProviders(<ProfilePicture user={testUser} />);
    fireEvent.drop(zone(), { dataTransfer: { types: ['Files'], files: [png('drop.png')] } });
    await waitFor(() => expect(uploads).toHaveLength(1));
  });

  it('uploads a screenshot pasted while the zone has the focus', async () => {
    renderWithProviders(<ProfilePicture user={testUser} />);
    zone().focus();
    expect(zone()).toHaveFocus();
    // A pasted screenshot is called "image" with no extension in some browsers.
    fireEvent.paste(zone(), {
      clipboardData: { files: [png('image')], types: ['Files'], getData: () => '' },
    });
    await waitFor(() => expect(uploads).toHaveLength(1));
  });

  it('refuses a file that is not a picture, or too big, without calling the API', async () => {
    renderWithProviders(<ProfilePicture user={testUser} />);
    const pdf = new File([new Uint8Array(3)], 'cv.pdf', { type: 'application/pdf' });
    fireEvent.drop(zone(), { dataTransfer: { types: ['Files'], files: [pdf] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a PNG, JPG, WebP or GIF');

    fireEvent.drop(zone(), {
      dataTransfer: { types: ['Files'], files: [png('big.png', 2_097_153)] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('larger than 2 MB');
    expect(uploads).toEqual([]);
  });

  it("shows the API's refusal", async () => {
    server.use(
      http.post('*/api/v1/users/me/avatar', () =>
        fail(422, 'FILE_TYPE_NOT_ALLOWED', 'The content of the file is not what its name says.'),
      ),
    );
    renderWithProviders(<ProfilePicture user={testUser} />);
    fireEvent.change(input(), { target: { files: [png()] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('not what its name says');
  });

  it('offers to remove a picture only when there is one', async () => {
    const { unmount } = renderWithProviders(<ProfilePicture user={testUser} />);
    expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<ProfilePicture user={withPicture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
    await waitFor(() => expect(removals).toBe(1));
    expect(await screen.findByText('Profile picture removed')).toBeInTheDocument();
  });
});
