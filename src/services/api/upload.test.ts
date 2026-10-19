import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { testAuth } from '@/test/fixtures';
import { apiPath, fail, ok, readUpload, server } from '@/test/server';

import { api, ApiError, tokenStore } from './index';

const form = () => {
  const body = new FormData();
  body.append('file', new File(['hello world'], 'notes.txt', { type: 'text/plain' }), 'notes.txt');
  return body;
};

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the request to fail');
}

describe('api.upload', () => {
  it('posts multipart with the bearer token and reports upload progress', async () => {
    tokenStore.set('token-abc');
    let received:
      { field: string; contentType: string; headers: Record<string, string | null> } | undefined;
    server.use(
      http.post(apiPath('/organizations/o1/files'), async ({ request }) => {
        const headers = {
          authorization: request.headers.get('Authorization'),
          accept: request.headers.get('Accept'),
          requestId: request.headers.get('X-Request-ID'),
          contentType: request.headers.get('Content-Type'),
        };
        received = { ...(await readUpload(request)), headers };
        return ok({ id: 'file-1' }, { status: 201 });
      }),
    );
    const progress: Array<{ loaded: number; total: number }> = [];

    const result = await api.upload<{ id: string }>('/organizations/o1/files', form(), {
      onProgress: (event) => progress.push(event),
    });

    expect(result).toEqual({ id: 'file-1' });
    expect(received?.field).toBe('file');
    expect(received?.contentType).toBe('text/plain');
    expect(received?.headers.authorization).toBe('Bearer token-abc');
    expect(received?.headers.accept).toBe('application/json');
    expect(received?.headers.requestId).toBeTruthy();
    expect(received?.headers.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(progress.length).toBeGreaterThan(0);
    const last = progress.at(-1);
    expect(last?.loaded).toBeGreaterThan(0);
    expect(last?.loaded).toBe(last?.total);
  });

  it('refreshes once on a 401 and repeats the upload with the new token', async () => {
    tokenStore.set('expired-token');
    const authHeaders: Array<string | null> = [];
    const refresh = vi.fn(() => ok(testAuth));
    server.use(
      http.post(apiPath('/files'), ({ request }) => {
        authHeaders.push(request.headers.get('Authorization'));
        return request.headers.get('Authorization') === 'Bearer access-token-1'
          ? ok({ id: 'file-1' }, { status: 201 })
          : fail(401, 'AUTH_TOKEN_EXPIRED', 'The access token has expired.');
      }),
      http.post(apiPath('/auth/refresh'), refresh),
    );

    await expect(api.upload('/files', form())).resolves.toEqual({ id: 'file-1' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(authHeaders).toEqual(['Bearer expired-token', 'Bearer access-token-1']);
    expect(tokenStore.get()).toBe('access-token-1');
  });

  it('throws the typed error of a refused upload, with details and Retry-After', async () => {
    server.use(
      http.post(apiPath('/files'), () =>
        fail(413, 'FILE_TOO_LARGE', 'The file is too large.', {
          details: { max_bytes: 10_485_760 },
        }),
      ),
    );
    const tooLarge = await catchError(api.upload('/files', form()));
    expect(tooLarge).toBeInstanceOf(ApiError);
    expect(tooLarge).toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
      message: 'The file is too large.',
      details: { max_bytes: 10_485_760 },
      requestId: 'req-test-123',
    });

    server.use(
      http.post(apiPath('/files'), () =>
        fail(429, 'RATE_LIMITED', 'Too many uploads.', { headers: { 'Retry-After': '90' } }),
      ),
    );
    expect(await catchError(api.upload('/files', form()))).toMatchObject({
      status: 429,
      retryAfter: 90,
    });
  });

  it('turns a network failure into status 0 / network_error', async () => {
    server.use(http.post(apiPath('/files'), () => HttpResponse.error()));
    expect(await catchError(api.upload('/files', form()))).toMatchObject({
      status: 0,
      code: 'network_error',
    });
  });

  it('can be cancelled: an abort surfaces as an AbortError, not as an ApiError', async () => {
    server.use(
      http.post(apiPath('/files'), async () => {
        await delay(500);
        return ok({ id: 'late' }, { status: 201 });
      }),
    );
    const controller = new AbortController();
    const pending = catchError(api.upload('/files', form(), { signal: controller.signal }));
    setTimeout(() => controller.abort(), 20);
    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as DOMException).name).toBe('AbortError');

    const already = new AbortController();
    already.abort();
    expect(
      ((await catchError(api.upload('/files', form(), { signal: already.signal }))) as DOMException)
        .name,
    ).toBe('AbortError');
  });
});

describe('api.getBlob', () => {
  it('returns the bytes, with the bearer token and the query', async () => {
    tokenStore.set('token-abc');
    let seen: { authorization: string | null; accept: string | null; search: string } | undefined;
    server.use(
      http.get(apiPath('/files/f1/content'), ({ request }) => {
        seen = {
          authorization: request.headers.get('Authorization'),
          accept: request.headers.get('Accept'),
          search: new URL(request.url).search,
        };
        return new HttpResponse('binary-bytes', { headers: { 'Content-Type': 'image/png' } });
      }),
    );

    const blob = await api.getBlob('/files/f1/content', { query: { download: true } });

    expect(await blob.text()).toBe('binary-bytes');
    expect(blob.type).toBe('image/png');
    expect(seen).toEqual({
      authorization: 'Bearer token-abc',
      accept: '*/*',
      search: '?download=true',
    });
  });

  it('throws the typed error when the file is not visible', async () => {
    server.use(
      http.get(apiPath('/files/f1/content'), () => fail(404, 'RESOURCE_NOT_FOUND', 'Not found.')),
    );
    expect(await catchError(api.getBlob('/files/f1/content'))).toMatchObject({
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('refreshes once on a 401 and retries', async () => {
    tokenStore.set('expired-token');
    server.use(
      http.get(apiPath('/files/f1/content'), ({ request }) =>
        request.headers.get('Authorization') === 'Bearer access-token-1'
          ? new HttpResponse('ok-bytes')
          : fail(401, 'AUTH_TOKEN_EXPIRED', 'The access token has expired.'),
      ),
      http.post(apiPath('/auth/refresh'), () => ok(testAuth)),
    );
    const blob = await api.getBlob('/files/f1/content');
    expect(await blob.text()).toBe('ok-bytes');
  });
});
