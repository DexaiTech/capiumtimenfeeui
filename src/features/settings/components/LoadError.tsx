import { ErrorState } from '@/components/ui';
import { isApiError } from '@/services/api';

export interface LoadErrorProps {
  title: string;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}

/** A failed load, in a card, with a retry. */
export function LoadError({ title, error, onRetry, retrying }: LoadErrorProps) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      <ErrorState
        title={title}
        error={isApiError(error) ? error : null}
        onRetry={onRetry}
        retrying={retrying}
      />
    </div>
  );
}
