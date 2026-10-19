import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { testAuth, testUser } from '@/test/fixtures';
import { apiPath, fail, ok, server } from '@/test/server';

import { api, ApiError, subscribeSession, tokenStore, type SessionEvent } from './index';

async function catchApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail');
}

function recordSessionEvents(): { events: SessionEvent[]; stop: () => void } {
  const events: SessionEvent[] = [];
  const stop = subscribeSession((event) => events.push(event));
  return { events, stop };
}

describe('envelope', () => {
  it('unwraps data from a success envelope', async () => {
    server.use(http.get(apiPath('/users/me'), () => ok(testUser)));
    await expect(api.get('/users/me')).resolves.toEqual(testUser);
  });

  it('returns data and meta for list endpoints', async () => {
    server.use(
      http.get(apiPath('/things'), () =>
        ok([{ id: 1 }], { meta: { next_cursor: 'abc', has_more: true } }),
      ),
    );
    const page = await api.list<{ id: number }>('/things');
    expect(page.data).toEqual([{ id: 1 }]);
    expect(page.meta).toEqual({ next_cursor: 'abc', has_more: true });
  });

  it('exposes the success message on request', async () => {
    server.use(
      http.post(apiPath('/auth/verify-email'), () => ok(null, { message: 'Email verified' })),
    );
    const result = await api.withMessage<null>('/auth/verify-email', {
      method: 'POST',
      body: { token: 't' },
    });
    expect(result).toMatchObject({ data: null, message: 'Email verified' });
  });

  it('serialises the body as JSON and repeats array query parameters', async () => {
    let received: { body: unknown; search: string; contentType: string | null } | undefined;
    server.use(
      http.post(apiPath('/things'), async ({ request }) => {
        received = {
          body: await request.json(),
          search: new URL(request.url).search,
          contentType: request.headers.get('Content-Type'),
        };
        return ok({ id: 1 }, { status: 201 });
      }),
    );
    await api.request('/things', {
      method: 'POST',
      body: { name: 'x' },
      query: { type: ['a', 'b'], q: undefined },
    });
    expect(received).toEqual({
      body: { name: 'x' },
      search: '?type=a&type=b',
      contentType: 'application/json',
    });
  });
});

describe('request headers', () => {
  it('sends Accept, a request id and the bearer token, without credentials', async () => {
    tokenStore.set('token-abc');
    let seen: Request | undefined;
    server.use(
      http.get(apiPath('/users/me'), ({ request }) => {
        seen = request;
        return ok(testUser);
      }),
    );
    await api.get('/users/me');
    expect(seen?.headers.get('Accept')).toBe('application/json');
    expect(seen?.headers.get('Authorization')).toBe('Bearer token-abc');
    expect(seen?.headers.get('X-Request-ID')).toMatch(/\S{8,}/);
    expect(seen?.headers.get('X-Requested-With')).toBeNull();
    expect(seen?.credentials).toBe('omit');
  });

  it('sends X-Requested-With and credentials on logout', async () => {
    let seen: Request | undefined;
    server.use(
      http.post(apiPath('/auth/logout'), ({ request }) => {
        seen = request;
        return ok(null);
      }),
    );
    await api.post('/auth/logout');
    expect(seen?.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(seen?.credentials).toBe('include');
  });
});

describe('ApiError mapping', () => {
  it('maps a 422 envelope with field details and the request id', async () => {
    const details = [{ field: 'email', code: 'invalid', message: 'Enter a valid email address' }];
    server.use(
      http.post(apiPath('/auth/register'), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
          details,
          requestId: 'req-422',
        }),
      ),
    );
    const error = await catchApiError(api.post('/auth/register', {}));
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      details,
      requestId: 'req-422',
    });
    expect(error.retryable).toBe(false);
  });

  it('reads Retry-After on a 429', async () => {
    server.use(
      http.post(apiPath('/auth/login'), () =>
        fail(429, 'RATE_LIMITED', 'Too many requests.', {
          details: { retry_after: 42 },
          headers: { 'Retry-After': '42' },
        }),
      ),
    );
    const error = await catchApiError(api.post('/auth/login', {}));
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 42 });
  });

  it('uses its own message for a 5xx and keeps the request id', async () => {
    server.use(
      http.get(apiPath('/users/me'), () =>
        fail(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.', {
          requestId: 'req-500',
        }),
      ),
    );
    const error = await catchApiError(api.get('/users/me'));
    expect(error).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      requestId: 'req-500',
      retryable: true,
    });
  });

  it('handles a response that is not an envelope', async () => {
    server.use(
      http.get(
        apiPath('/users/me'),
        () => new HttpResponse('<html>Bad gateway</html>', { status: 502 }),
      ),
    );
    const error = await catchApiError(api.get('/users/me'));
    expect(error).toMatchObject({ status: 502, code: 'invalid_response' });
  });

  it('turns a network failure into status 0 / network_error', async () => {
    server.use(http.get(apiPath('/users/me'), () => HttpResponse.error()));
    const error = await catchApiError(api.get('/users/me'));
    expect(error).toMatchObject({ status: 0, code: 'network_error', retryable: true });
  });

  it('turns a timeout into status 0 / timeout', async () => {
    server.use(
      http.get(apiPath('/users/me'), async () => {
        await delay(500);
        return ok(testUser);
      }),
    );
    const error = await catchApiError(api.get('/users/me', { timeoutMs: 20 }));
    expect(error).toMatchObject({ status: 0, code: 'timeout' });
  });

  it('lets a caller abort surface as an abort, not as an ApiError', async () => {
    server.use(
      http.get(apiPath('/users/me'), async () => {
        await delay(500);
        return ok(testUser);
      }),
    );
    const controller = new AbortController();
    const pending = api.get('/users/me', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(ApiError);
  });
});

describe('401 handling', () => {
  it('refreshes once and retries the original request with the new token', async () => {
    tokenStore.set('expired-token');
    const authHeaders: Array<string | null> = [];
    const refresh = vi.fn((request: Request) => {
      expect(request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
      expect(request.credentials).toBe('include');
      return ok(testAuth);
    });
    server.use(
      http.get(apiPath('/users/me'), ({ request }) => {
        authHeaders.push(request.headers.get('Authorization'));
        return request.headers.get('Authorization') === 'Bearer access-token-1'
          ? ok(testUser)
          : fail(401, 'AUTH_TOKEN_EXPIRED', 'The access token has expired.');
      }),
      http.post(apiPath('/auth/refresh'), ({ request }) => refresh(request)),
    );
    const { events, stop } = recordSessionEvents();

    await expect(api.get('/users/me')).resolves.toEqual(testUser);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(authHeaders).toEqual(['Bearer expired-token', 'Bearer access-token-1']);
    expect(tokenStore.get()).toBe('access-token-1');
    expect(events).toEqual([{ type: 'started', auth: testAuth, remote: false }]);
    stop();
  });

  it('single-flights the refresh for concurrent 401s', async () => {
    tokenStore.set('expired-token');
    const refresh = vi.fn(async () => {
      await delay(30);
      return ok(testAuth);
    });
    server.use(
      http.get(apiPath('/items/:id'), ({ request, params }) =>
        request.headers.get('Authorization') === 'Bearer access-token-1'
          ? ok({ id: params.id })
          : fail(401, 'AUTH_TOKEN_EXPIRED', 'The access token has expired.'),
      ),
      http.post(apiPath('/auth/refresh'), refresh),
    );

    const results = await Promise.all([
      api.get('/items/1'),
      api.get('/items/2'),
      api.get('/items/3'),
    ]);

    expect(results).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ends the session when the refresh itself returns 401', async () => {
    tokenStore.set('expired-token');
    const protectedCalls = vi.fn(() =>
      fail(401, 'AUTH_TOKEN_EXPIRED', 'The access token has expired.'),
    );
    server.use(
      http.get(apiPath('/users/me'), protectedCalls),
      http.post(apiPath('/auth/refresh'), () =>
        fail(401, 'AUTH_REFRESH_INVALID', 'Please sign in again.'),
      ),
    );
    const { events, stop } = recordSessionEvents();

    const error = await catchApiError(api.get('/users/me'));

    expect(error).toMatchObject({ status: 401, code: 'AUTH_REFRESH_INVALID' });
    expect(protectedCalls).toHaveBeenCalledTimes(1); // the original request is not replayed
    expect(tokenStore.get()).toBeNull();
    expect(events).toEqual([{ type: 'ended', reason: 'expired', remote: false }]);
    stop();
  });

  it('keeps the session when the refresh fails with a network error', async () => {
    tokenStore.set('expired-token');
    server.use(
      http.get(apiPath('/users/me'), () =>
        fail(401, 'AUTH_TOKEN_EXPIRED', 'The access token has expired.'),
      ),
      http.post(apiPath('/auth/refresh'), () => HttpResponse.error()),
    );
    const { events, stop } = recordSessionEvents();

    const error = await catchApiError(api.get('/users/me'));

    expect(error).toMatchObject({ status: 0, code: 'network_error' });
    expect(tokenStore.get()).toBe('expired-token');
    expect(events).toEqual([]);
    stop();
  });

  it('does not retry a second 401 and treats the session as failed', async () => {
    tokenStore.set('expired-token');
    const protectedCalls = vi.fn(() =>
      fail(401, 'AUTH_TOKEN_INVALID', 'The access token is invalid.'),
    );
    const refresh = vi.fn(() => ok(testAuth));
    server.use(
      http.get(apiPath('/users/me'), protectedCalls),
      http.post(apiPath('/auth/refresh'), refresh),
    );

    const error = await catchApiError(api.get('/users/me'));

    expect(error).toMatchObject({ status: 401, code: 'AUTH_TOKEN_INVALID' });
    expect(protectedCalls).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBeNull();
  });

  it('never refreshes for a 401 from the login endpoint', async () => {
    const refresh = vi.fn(() => ok(testAuth));
    server.use(
      http.post(apiPath('/auth/login'), () =>
        fail(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.'),
      ),
      http.post(apiPath('/auth/refresh'), refresh),
    );

    const error = await catchApiError(api.post('/auth/login', { email: 'a@b.co', password: 'x' }));

    expect(error).toMatchObject({ status: 401, code: 'AUTH_INVALID_CREDENTIALS' });
    expect(refresh).not.toHaveBeenCalled();
  });
});
