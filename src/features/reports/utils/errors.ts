import { isApiError } from '@/services/api';
import { formatWait } from '@/utils/format';

export interface ErrorNotice {
  title: string;
  description?: string;
}

/** The uniform wording of a failed action, for a toast. */
export function describeFailure(error: unknown, fallbackTitle: string): ErrorNotice {
  if (!isApiError(error)) {
    return { title: fallbackTitle, description: 'An unexpected error occurred. Please try again.' };
  }
  if (error.status === 403) {
    return { title: "You don't have permission to do that", description: error.message };
  }
  if (error.status === 429) {
    return {
      title: 'Too many requests',
      description: `Try again in ${formatWait(error.retryAfter ?? 60)}.`,
    };
  }
  return { title: fallbackTitle, description: error.message };
}
