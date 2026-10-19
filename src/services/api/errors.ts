export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  retryAfter?: number;
}

/**
 * The one error type thrown by the API client.
 * `status` is the HTTP status, or 0 for a network failure or timeout
 * (codes `network_error` and `timeout`).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;
  /** Seconds to wait before retrying, from `Retry-After` (429 and 503). */
  readonly retryAfter?: number;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
  }

  /** True when the request may succeed if simply repeated (network, timeout, 5xx). */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export const NETWORK_ERROR_MESSAGE =
  'Could not reach the server. Check your connection and try again.';
export const TIMEOUT_MESSAGE = 'The server took too long to respond. Please try again.';
export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';

/** 403 code of every route but sign-in and password change while a temporary password is in use. */
export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';
