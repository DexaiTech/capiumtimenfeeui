import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from '@/components/ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** App-level boundary around the router: catches failures of the shell itself. */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled rendering error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <ErrorState
          title="The application failed to load"
          error={{
            message:
              'An unexpected error stopped the page from rendering. Reloading usually fixes it.',
          }}
          retryLabel="Reload"
          onRetry={() => window.location.reload()}
        />
      </main>
    );
  }
}
