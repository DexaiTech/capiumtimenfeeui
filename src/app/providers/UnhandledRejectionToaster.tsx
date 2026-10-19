import { useEffect } from 'react';

import { useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

/** Safety net: a rejected promise nobody handled is a bug, but it must still end in a visible state. */
export function UnhandledRejectionToaster() {
  const { toast } = useToast();

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      console.error('Unhandled promise rejection', reason);
      toast({
        tone: 'error',
        title: 'Something went wrong',
        description: isApiError(reason)
          ? reason.message
          : 'An unexpected error occurred. Please try again.',
      });
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [toast]);

  return null;
}
