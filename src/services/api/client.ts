import type { PageMeta } from '@/types/api';

import { refreshesOn401 } from './config';
import { ApiError, SERVER_ERROR_MESSAGE } from './errors';
import { refreshSession } from './refresh';
import { endSession } from './session';
import {
  send,
  sendUpload,
  unwrap,
  unwrapBlob,
  type ApiResult,
  type RequestOptions,
  type UploadOptions,
} from './transport';

type BodylessOptions = Omit<RequestOptions, 'method' | 'body'>;

/**
 * Runs one exchange, and on a 401 makes one (shared) refresh attempt and repeats the
 * exchange once. Every kind of request (JSON, upload, binary) goes through here.
 */
async function withRefresh(path: string, attempt: () => Promise<Response>): Promise<Response> {
  let response = await attempt();

  if (response.status === 401 && refreshesOn401(path)) {
    await refreshSession(); // throws when the refresh fails; a 401 there already ended the session
    response = await attempt();
    // A second 401 is not retried: the session is treated as failed.
    if (response.status === 401) endSession('expired');
  }

  return response;
}

/** The single entry point for JSON API calls. */
async function requestWithMeta<TData, TMeta = PageMeta | null>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<TData, TMeta>> {
  return unwrap<TData, TMeta>(await withRefresh(path, () => send(path, options)));
}

/**
 * Multipart POST with real upload progress (XMLHttpRequest). The access token is attached
 * from memory and an expired one is refreshed and the upload repeated once, like any request.
 */
async function upload<TData>(
  path: string,
  body: FormData,
  options: UploadOptions = {},
): Promise<TData> {
  const response = await withRefresh(path, () => sendUpload(path, body, options));
  return (await unwrap<TData>(response)).data;
}

/** Reads raw bytes (file content). No fixed timeout unless one is given: files can be large. */
async function getBlob(path: string, options: BodylessOptions = {}): Promise<Blob> {
  const request: RequestOptions = { timeoutMs: 0, accept: '*/*', ...options, method: 'GET' };
  return unwrapBlob(await withRefresh(path, () => send(path, request)));
}

export interface StreamOptions {
  /** Aborts the connection attempt. Once the stream is open, cancel its reader to close it. */
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * Opens a server-sent event stream (`text/event-stream`) with the Bearer header, never a token
 * in the URL. A 401 on connect goes through the normal refresh path once. Resolves to the body
 * of a successful response; a failed one throws the usual `ApiError` (with `retryAfter` for 429).
 */
async function openStream(
  path: string,
  options: StreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const request: RequestOptions = {
    method: 'GET',
    timeoutMs: 0,
    accept: 'text/event-stream',
    signal: options.signal,
    headers: options.headers,
  };
  const response = await withRefresh(path, () => send(path, request));
  if (!response.ok) await unwrap(response); // always throws for a failed response
  if (!response.ok || !response.body) {
    throw new ApiError({
      status: response.ok ? 502 : response.status,
      code: 'invalid_response',
      message: SERVER_ERROR_MESSAGE,
    });
  }
  return response.body;
}

async function request<TData>(path: string, options: RequestOptions = {}): Promise<TData> {
  return (await requestWithMeta<TData>(path, options)).data;
}

export const api = {
  request,
  upload,
  getBlob,
  openStream,
  /** For list endpoints: resolves to `{data, meta}` so hooks can read `meta.next_cursor`. */
  list: <TItem>(path: string, options?: BodylessOptions) =>
    requestWithMeta<TItem[], PageMeta>(path, { ...options, method: 'GET' }),
  /** For actions whose success message matters to the caller. */
  withMessage: <TData>(path: string, options?: RequestOptions) =>
    requestWithMeta<TData>(path, options),
  get: <TData>(path: string, options?: BodylessOptions) =>
    request<TData>(path, { ...options, method: 'GET' }),
  post: <TData>(path: string, body?: unknown, options?: BodylessOptions) =>
    request<TData>(path, { ...options, method: 'POST', body }),
  patch: <TData>(path: string, body?: unknown, options?: BodylessOptions) =>
    request<TData>(path, { ...options, method: 'PATCH', body }),
  put: <TData>(path: string, body?: unknown, options?: BodylessOptions) =>
    request<TData>(path, { ...options, method: 'PUT', body }),
  delete: <TData>(path: string, options?: BodylessOptions) =>
    request<TData>(path, { ...options, method: 'DELETE' }),
};
