import { REQUEST_TIMEOUT_MS } from '@/constants/limits';
import type { Envelope, PageMeta } from '@/types/api';

import { needsCredentials, needsRequestedWith, resolveApiUrl } from './config';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  PASSWORD_CHANGE_REQUIRED_CODE,
  SERVER_ERROR_MESSAGE,
  TIMEOUT_MESSAGE,
} from './errors';
import { emitAccountNotice } from './session';
import { tokenStore } from './tokenStore';

export type QueryValue =
  string | number | boolean | null | undefined | ReadonlyArray<string | number>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** A plain value is sent as JSON; FormData is sent as multipart. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Forwarded from TanStack Query so an unneeded request is aborted. */
  signal?: AbortSignal;
  /** Milliseconds; 0 disables the timeout (uploads). Defaults to 20 seconds. */
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** The `Accept` header; JSON unless the caller reads raw bytes (`getBlob`). */
  accept?: string;
}

export interface UploadOptions {
  query?: Record<string, QueryValue>;
  /** Aborting cancels the upload; the promise rejects with an `AbortError`. */
  signal?: AbortSignal;
  /** Called with the bytes sent so far; `total` is 0 when the browser cannot tell. */
  onProgress?: (progress: { loaded: number; total: number }) => void;
}

export interface ApiResult<TData, TMeta = PageMeta | null> {
  data: TData;
  meta: TMeta;
  message: string | null;
}

function buildSearch(query: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    // Multiple values repeat the parameter (docs/api.md, "Filtering and search").
    if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
    else params.append(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/** Performs one HTTP exchange. Network failures and timeouts become `ApiError` with status 0. */
export async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, query, signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const headers = new Headers(options.headers);
  headers.set('Accept', options.accept ?? 'application/json');
  headers.set('X-Request-ID', newRequestId());
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (needsRequestedWith(path)) headers.set('X-Requested-With', 'XMLHttpRequest');

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // the browser sets the multipart boundary
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    return await fetch(resolveApiUrl(path, buildSearch(query)), {
      method,
      headers,
      body: payload,
      signal: controller.signal,
      credentials: needsCredentials(path) ? 'include' : 'omit',
    });
  } catch (cause) {
    // A caller-initiated abort is not an error state; let the caller (TanStack Query) see it as such.
    if (signal?.aborted) throw cause;
    throw timedOut
      ? new ApiError({ status: 0, code: 'timeout', message: TIMEOUT_MESSAGE })
      : new ApiError({ status: 0, code: 'network_error', message: NETWORK_ERROR_MESSAGE });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function parseRawHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    try {
      headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
    } catch {
      // A header the Headers class refuses is of no interest to the client.
    }
  }
  return headers;
}

/**
 * One multipart POST through XMLHttpRequest, because `fetch` reports no upload progress.
 * Carries the same headers as `send` and resolves to a `Response`, so the envelope
 * handling and the 401 → refresh → retry path are shared. Uploads have no fixed timeout.
 */
export function sendUpload(
  path: string,
  body: FormData,
  options: UploadOptions = {},
): Promise<Response> {
  const { query, signal, onProgress } = options;
  return new Promise<Response>((resolve, reject) => {
    const abortError = () => new DOMException('The upload was cancelled.', 'AbortError');
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', resolveApiUrl(path, buildSearch(query)));
    xhr.withCredentials = needsCredentials(path);
    xhr.responseType = 'text';
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Request-ID', newRequestId());
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    function onAbort() {
      xhr.abort();
      // Settled here as well: the caller is released even if no abort event follows.
      cleanup();
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 });
      });
    }
    xhr.addEventListener('load', () => {
      cleanup();
      // 204, 205 and 304 may not carry a body in a Response.
      const empty = xhr.status === 204 || xhr.status === 205 || xhr.status === 304;
      resolve(
        new Response(empty ? null : xhr.responseText, {
          status: xhr.status,
          headers: parseRawHeaders(xhr.getAllResponseHeaders()),
        }),
      );
    });
    xhr.addEventListener('error', () => {
      cleanup();
      reject(new ApiError({ status: 0, code: 'network_error', message: NETWORK_ERROR_MESSAGE }));
    });
    xhr.addEventListener('abort', () => {
      cleanup();
      reject(abortError());
    });
    xhr.send(body);
  });
}

function parseRetryAfter(response: Response, details: unknown): number | undefined {
  const header = response.headers.get('Retry-After');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  if (typeof details === 'object' && details !== null && 'retry_after' in details) {
    const seconds = Number(details.retry_after);
    if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  }
  return undefined;
}

async function readEnvelope<TData, TMeta>(
  response: Response,
): Promise<Envelope<TData, TMeta> | null> {
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
      return parsed as Envelope<TData, TMeta>;
    }
    return null;
  } catch {
    return null;
  }
}

/** The body of a successful binary response; a failed one carries the usual error envelope. */
export async function unwrapBlob(response: Response): Promise<Blob> {
  if (response.ok) return response.blob();
  await unwrap(response); // always throws for a failed response
  throw new ApiError({
    status: response.status,
    code: 'invalid_response',
    message: SERVER_ERROR_MESSAGE,
  });
}

/** Unwraps the success envelope or throws the typed error for a failed one. */
export async function unwrap<TData, TMeta = PageMeta | null>(
  response: Response,
): Promise<ApiResult<TData, TMeta>> {
  const headerRequestId = response.headers.get('X-Request-ID') ?? undefined;
  const envelope = await readEnvelope<TData, TMeta>(response);

  if (envelope?.success === true && response.ok) {
    return { data: envelope.data, meta: envelope.meta, message: envelope.message ?? null };
  }

  if (envelope?.success === false) {
    const { code, message, details, request_id: bodyRequestId } = envelope.error;
    // A temporary password must be replaced before anything else works: tell the application.
    if (response.status === 403 && code === PASSWORD_CHANGE_REQUIRED_CODE) {
      emitAccountNotice('password-change-required');
    }
    throw new ApiError({
      status: response.status,
      code,
      // Messages come from the server for 4xx; the client supplies its own text for 5xx.
      message: response.status >= 500 ? SERVER_ERROR_MESSAGE : message,
      details: details ?? undefined,
      requestId: headerRequestId ?? bodyRequestId ?? undefined,
      retryAfter: parseRetryAfter(response, details),
    });
  }

  // Not an envelope at all: a proxy error page, an empty body, a misrouted request.
  throw new ApiError({
    status: response.ok ? 502 : response.status,
    code: 'invalid_response',
    message: SERVER_ERROR_MESSAGE,
    requestId: headerRequestId,
    retryAfter: parseRetryAfter(response, undefined),
  });
}
