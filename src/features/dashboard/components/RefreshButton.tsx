import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface RefreshButtonProps {
  /** What is refreshed, for the accessible name: "Refresh Billing Trend". */
  label: string;
  onRefresh: () => void;
  refreshing: boolean;
}

/** The icon button of a widget header that asks the API for fresh figures. */
export function RefreshButton({ label, onRefresh, refreshing }: RefreshButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Refresh ${label}`}
      title={`Refresh ${label}`}
      aria-busy={refreshing || undefined}
      disabled={refreshing}
      onClick={onRefresh}
    >
      <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} aria-hidden="true" />
    </Button>
  );
}
