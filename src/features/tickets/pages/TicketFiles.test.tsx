import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenStore } from '@/services/api';
import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, readUpload, server } from '@/test/server';

import {
  chooseFiles,
  csvFile,
  freshDetail,
  installObjectUrls,
  notesCsv,
  pngFile,
  renderDetail,
} from '../test/detailHelpers';
import { screenshot, trialBalancePdf } from '../test/fixtures';
import { gate, orgApiPath, ticketHandlers } from '../test/handlers';

let urls: ReturnType<typeof installObjectUrls>;
beforeEach(() => {
  urls = installObjectUrls();
});
afterEach(() => {
  urls.restore();
});

const ticketFiles = () => screen.getByRole('region', { name: 'Attachments' });
const uploadsList = () => screen.findByRole('list', { name: 'Uploads' });

describe('the files of a ticket', () => {
  it("shows the ticket's own files with name and size, and keeps a comment's file in its comment", async () => {
    server.use(...ticketHandlers());
    renderDetail();

    await screen.findByRole('heading', { level: 1, name: 'APT1' });
    const files = ticketFiles();
    expect(within(files).getByRole('button', { name: 'Preview screenshot.png' })).toHaveTextContent(
      '69 B',
    );
    expect(
      within(files).getByRole('button', { name: 'Download trial-balance.pdf' }),
    ).toHaveTextContent('138.7 KB');
    expect(within(files).queryByText('differences.xlsx')).not.toBeInTheDocument();
    // It is shown in the comment it belongs to.
    expect(
      await screen.findByRole('button', { name: 'Download differences.xlsx' }),
    ).toHaveTextContent('8.6 KB');
  });

  it('fetches an image with the token, shows it from a blob URL and releases the URL on leaving', async () => {
    tokenStore.set('token-abc');
    const fetched: Array<{ id: string; authorization: string | null }> = [];
    server.use(
      ...ticketHandlers({
        onFile: (id, request) =>
          fetched.push({ id, authorization: request.headers.get('Authorization') }),
      }),
    );
    const view = renderDetail();

    await waitFor(() => expect(urls.created).toHaveLength(1));
    await waitFor(() => expect(document.querySelector('img[src^="blob:"]')).not.toBeNull());
    expect(document.querySelector('img[src^="blob:"]')).toHaveAttribute('src', urls.created[0]);
    // Only the image is fetched for its thumbnail; the other files wait for a click.
    expect(fetched).toEqual([{ id: screenshot.id, authorization: 'Bearer token-abc' }]);
    expect(urls.revoked).toEqual([]);

    view.unmount();
    expect(urls.revoked).toEqual([urls.created[0]]);
  });

  it('previews an image in a dialog from the bytes it already has', async () => {
    const user = userEvent.setup();
    const fetched: string[] = [];
    server.use(...ticketHandlers({ onFile: (id) => fetched.push(id) }));
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Preview screenshot.png' }));
    const dialog = await screen.findByRole('dialog', { name: 'screenshot.png' });
    expect(dialog).toHaveTextContent('69 B');
    expect(await within(dialog).findByRole('img', { name: 'screenshot.png' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^blob:/),
    );
    // The thumbnail's bytes were reused.
    expect(fetched).toEqual([screenshot.id]);

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'screenshot.png' })).not.toBeInTheDocument(),
    );
    expect(urls.revoked.length).toBeGreaterThan(0);
  });

  it('downloads a file under its own name', async () => {
    const user = userEvent.setup();
    const saved: Array<{ download: string; href: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ download: this.download, href: this.href });
    });
    server.use(...ticketHandlers());
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Download trial-balance.pdf' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.download).toBe('trial-balance.pdf');
    expect(saved[0]?.href).toMatch(/^blob:/);
    // The temporary URL is released at once.
    expect(urls.revoked).toContain(saved[0]?.href);
  });

  it('says why a file could not be downloaded', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(orgApiPath('/tickets/:ticketId/attachments/:attachmentId'), () =>
        fail(404, 'ATTACHMENT_FILE_MISSING', 'The file is no longer in storage.'),
      ),
      ...ticketHandlers(),
    );
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Download trial-balance.pdf' }));

    expect(await screen.findByText('Could not download trial-balance.pdf')).toBeInTheDocument();
    expect(screen.getByText('The file is no longer in storage.')).toBeInTheDocument();
    // A thumbnail that cannot load falls back to the icon of its kind.
    expect(document.querySelector('img[src^="blob:"]')).toBeNull();
  });

  it('deletes a file after a confirmation that names it', async () => {
    const user = userEvent.setup();
    const detail = freshDetail();
    const deleted: unknown[] = [];
    server.use(
      http.delete(orgApiPath('/tickets/:ticketId/attachments/:attachmentId'), ({ params }) => {
        deleted.push(params.attachmentId);
        detail.attachments = detail.attachments.filter((file) => file.id !== params.attachmentId);
        return ok(null, { message: 'File deleted' });
      }),
      ...ticketHandlers({ detail }),
    );
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Delete trial-balance.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete file?' });
    expect(dialog).toHaveTextContent(
      'trial-balance.pdf will be removed from the ticket. This cannot be undone.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete file' }));

    await waitFor(() => expect(deleted).toEqual([trialBalancePdf.id]));
    expect(await screen.findByText('trial-balance.pdf deleted')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(ticketFiles()).queryByText('trial-balance.pdf')).not.toBeInTheDocument(),
    );
    expect(within(ticketFiles()).getByText('screenshot.png')).toBeInTheDocument();
  });

  it('keeps the dialog open with the reason when the API refuses the delete', async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(orgApiPath('/tickets/:ticketId/attachments/:attachmentId'), () =>
        fail(403, 'PERMISSION_DENIED', 'You may only delete your own files.'),
      ),
      ...ticketHandlers(),
    );
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Delete trial-balance.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete file?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete file' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You may only delete your own files.',
    );
  });

  it("offers the × on every file to a role that may delete, and on one's own files to the rest", async () => {
    server.use(...ticketHandlers());
    const owner = renderDetail(OWNER_PERMISSIONS);
    await screen.findByRole('button', { name: 'Delete screenshot.png' });
    expect(screen.getByRole('button', { name: 'Delete trial-balance.pdf' })).toBeInTheDocument();
    owner.unmount();

    const staff = renderDetail(STAFF_PERMISSIONS);
    await screen.findByRole('button', { name: 'Delete screenshot.png' });
    // Uploaded by someone else.
    expect(
      screen.queryByRole('button', { name: 'Delete trial-balance.pdf' }),
    ).not.toBeInTheDocument();
    staff.unmount();

    renderDetail(['ticket.read']);
    await screen.findByRole('button', { name: 'Preview screenshot.png' });
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();
  });
});

describe('uploading a file', () => {
  it('lists the accepted types and the size limit', async () => {
    server.use(...ticketHandlers());
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Choose a file' })).toBeInTheDocument();
    expect(screen.getByText('Max file size: 2 MB')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Accepted file types' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Image', 'PDF', 'DOC/DOCX', 'XLS/XLSX', 'CSV']);
    expect(document.querySelector<HTMLInputElement>('input[type="file"]')).toHaveAttribute(
      'accept',
      '.png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv',
    );
  });

  it('uploads a chosen file as the form field "file", shows its progress, then the file in the grid', async () => {
    const detail = freshDetail();
    const pending = gate();
    const seen: Array<{ field: string; contentType: string }> = [];
    server.use(
      http.post(orgApiPath('/tickets/:ticketId/attachments'), async ({ request }) => {
        seen.push(await readUpload(request));
        await pending.promise;
        detail.attachments.push(notesCsv);
        return ok(notesCsv, { status: 201, message: 'File uploaded' });
      }),
      ...ticketHandlers({ detail }),
    );
    renderDetail();
    await screen.findByRole('button', { name: 'Choose a file' });

    chooseFiles(csvFile());

    expect(
      await screen.findByRole('progressbar', { name: 'Uploading notes.csv' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(seen).toEqual([{ field: 'file', contentType: 'text/csv' }]));
    pending.open();

    expect(await screen.findByRole('button', { name: 'Download notes.csv' })).toBeInTheDocument();
    expect(within(ticketFiles()).getByText('notes.csv')).toBeInTheDocument();
    // The grid shows it now: the row of the upload is gone.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Uploads' })).not.toBeInTheDocument();
  });

  it('refuses a file over 2 MB, an empty file and another type before sending anything', async () => {
    let posts = 0;
    server.use(
      http.post(orgApiPath('/tickets/:ticketId/attachments'), () => {
        posts += 1;
        return ok(notesCsv, { status: 201 });
      }),
      ...ticketHandlers(),
    );
    renderDetail();
    await screen.findByRole('button', { name: 'Choose a file' });

    chooseFiles(
      new File([new Uint8Array(2_097_153)], 'big.png', { type: 'image/png' }),
      new File([], 'empty.csv', { type: 'text/csv' }),
      new File(['MZ'], 'virus.exe', { type: 'application/octet-stream' }),
    );

    const uploads = await uploadsList();
    expect(
      within(uploads)
        .getAllByRole('alert')
        .map((alert) => alert.textContent),
    ).toEqual([
      'big.png is larger than 2 MB (2.0 MB).',
      'empty.csv is empty.',
      'virus.exe is not an accepted type. Use an image, PDF, Word, Excel or CSV file.',
    ]);
    expect(posts).toBe(0);
  });

  it("shows the API's own message when it refuses a file, and lets go of the row on ×", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/tickets/:ticketId/attachments'), () =>
        fail(413, 'ATTACHMENT_TOO_LARGE', 'The file is larger than 2 MB.'),
      ),
      ...ticketHandlers(),
    );
    renderDetail();
    await screen.findByRole('button', { name: 'Choose a file' });

    chooseFiles(pngFile('photo.png'));
    const uploads = await uploadsList();
    expect(await within(uploads).findByRole('alert')).toHaveTextContent(
      'The file is larger than 2 MB.',
    );

    await user.click(within(uploads).getByRole('button', { name: 'Remove photo.png' }));
    expect(screen.queryByRole('list', { name: 'Uploads' })).not.toBeInTheDocument();
  });

  it('shows the message of a type the API does not take', async () => {
    server.use(
      http.post(orgApiPath('/tickets/:ticketId/attachments'), () =>
        fail(
          422,
          'ATTACHMENT_TYPE_NOT_ALLOWED',
          'The content of this file does not match its extension.',
        ),
      ),
      ...ticketHandlers(),
    );
    renderDetail();
    await screen.findByRole('button', { name: 'Choose a file' });

    chooseFiles(pngFile('renamed.png'));

    expect(await within(await uploadsList()).findByRole('alert')).toHaveTextContent(
      'The content of this file does not match its extension.',
    );
  });

  it('stops an upload that is removed while it runs, without reporting an error', async () => {
    const user = userEvent.setup();
    const pending = gate();
    server.use(
      http.post(orgApiPath('/tickets/:ticketId/attachments'), async () => {
        await pending.promise;
        return ok(notesCsv, { status: 201 });
      }),
      ...ticketHandlers(),
    );
    renderDetail();
    await screen.findByRole('button', { name: 'Choose a file' });

    chooseFiles(csvFile());
    const uploads = await uploadsList();
    await user.click(await within(uploads).findByRole('button', { name: 'Remove notes.csv' }));

    expect(screen.queryByRole('list', { name: 'Uploads' })).not.toBeInTheDocument();
    pending.open();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uploads an image pasted anywhere on the page, and a file dropped on the zone', async () => {
    let posts = 0;
    server.use(
      http.post(orgApiPath('/tickets/:ticketId/attachments'), () => {
        posts += 1;
        return ok(notesCsv, { status: 201 });
      }),
      ...ticketHandlers(),
    );
    renderDetail();
    await screen.findByRole('button', { name: 'Choose a file' });

    fireEvent.paste(document.body, {
      clipboardData: { files: [pngFile('screenshot-2.png')], types: ['Files'], getData: () => '' },
    });
    await waitFor(() => expect(posts).toBe(1));

    const zone = screen.getByText(/drag it here or paste it/).closest('div');
    if (!zone) throw new Error('no drop zone');
    fireEvent.drop(zone, { dataTransfer: { files: [csvFile()], types: ['Files'] } });
    await waitFor(() => expect(posts).toBe(2));
  });

  it('leaves a paste into a text field to the field', async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.post(orgApiPath('/tickets/:ticketId/attachments'), () => {
        posts += 1;
        return ok(notesCsv, { status: 201 });
      }),
      ...ticketHandlers(),
    );
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Edit subject' }));
    fireEvent.paste(screen.getByRole('textbox', { name: 'Subject' }), {
      clipboardData: { files: [pngFile()], types: ['Files'], getData: () => '' },
    });

    expect(screen.queryByRole('list', { name: 'Uploads' })).not.toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it('offers no upload to a role that may only read', async () => {
    server.use(...ticketHandlers());
    renderDetail(['ticket.read']);

    expect(
      await screen.findByText('Your role can open the files of this ticket but not add new ones.'),
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
