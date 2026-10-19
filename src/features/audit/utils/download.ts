import { isApiError } from '@/services/api';

/** What a failed export tells the person: the API's own words, with the request id to quote. */
export function exportFailure(error: unknown): string {
  if (!isApiError(error)) return 'An unexpected error occurred. Please try again.';
  if (error.status === 403) return 'Your role does not include exporting the audit log.';
  return error.requestId ? `${error.message} (Request ID: ${error.requestId})` : error.message;
}

/** Offers a blob to the browser as a file download. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
