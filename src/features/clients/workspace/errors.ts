import { isApiError } from '@/services/api';

export interface Failure {
  message: string;
  requestId?: string;
  code?: string;
}

/** What to tell the person about a failed request: the API's own words, else a generic line. */
export function describeError(error: unknown): Failure {
  if (isApiError(error)) {
    return { message: error.message, requestId: error.requestId, code: error.code };
  }
  return { message: 'An unexpected error occurred. Please try again.' };
}

/** The API's refusal code of a failed request (`RATE_IN_USE`, `CLIENT_IN_USE`, …), if it gave one. */
export function errorCode(error: unknown): string | undefined {
  return isApiError(error) ? error.code : undefined;
}
