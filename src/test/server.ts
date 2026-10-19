import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';

/** Matches the API under any origin, e.g. `apiPath('/auth/login')`. */
export const apiPath = (path: string) => `*/api/v1${path}`;

/** The real success envelope (docs/api.md). */
export function ok(
  data: JsonBodyType,
  init: { status?: number; message?: string | null; meta?: JsonBodyType } = {},
) {
  return HttpResponse.json(
    { success: true, data, message: init.message ?? null, meta: init.meta ?? null },
    { status: init.status ?? 200, headers: { 'X-Request-ID': 'req-ok' } },
  );
}

/** The real error envelope. */
export function fail(
  status: number,
  code: string,
  message: string,
  init: { details?: JsonBodyType; headers?: Record<string, string>; requestId?: string } = {},
) {
  const requestId = init.requestId ?? 'req-test-123';
  return HttpResponse.json(
    {
      success: false,
      error: { code, message, details: init.details ?? null, request_id: requestId },
    },
    { status, headers: { 'X-Request-ID': requestId, ...init.headers } },
  );
}

/**
 * Every test starts in an open deployment, as before milestone 11; a closed one is opted
 * into with `mockSystem(...)` in `test/systemFixtures.ts`.
 */
export const defaultHandlers = [
  http.get(apiPath('/system'), () => ok({ closed_deployment: false, organization: null })),
  // The shell's bell asks for the unread count in every practice; most tests have none.
  http.get(apiPath('/organizations/:organizationId/notifications/unread-count'), () =>
    ok({ count: 0 }),
  ),
];

/** Tests add the handlers they need with `server.use(...)`; an unhandled request fails the test. */
export const server = setupServer(...defaultHandlers);

export interface UploadedPart {
  /** The form field name, for example `file`. */
  field: string;
  /** The declared type of the part. */
  contentType: string;
}

/**
 * Reads the file part of a multipart upload from the raw body. Under jsdom the request is
 * re-encoded by the interceptor, which keeps the field name and the part's content type but
 * not the filename or the bytes; those are asserted in the Playwright specification.
 */
export async function readUpload(request: Request): Promise<UploadedPart> {
  const raw = await request.text();
  const header = /name="([^"]*)"; filename="[^"]*"\r\n(?:Content-Type: ([^\r\n]*)\r\n)?/.exec(raw);
  return { field: header?.[1] ?? '', contentType: header?.[2] ?? '' };
}
