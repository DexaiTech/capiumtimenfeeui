import { Construction, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout';
import { Card, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks';

export interface PlaceholderPageProps {
  /** The module or page title, for example "Clients". */
  title: string;
  /** One line under the title: what the page will do. */
  description: string;
  icon?: LucideIcon;
  /** Extra facts to show in the card (the id of a detail page). */
  children?: ReactNode;
}

/**
 * Stands in for a page whose route exists before the page is built. Each feature replaces
 * its placeholder file with the real page; the route and the file name stay the same.
 */
export function PlaceholderPage({
  title,
  description,
  icon: Icon = Construction,
  children,
}: PlaceholderPageProps) {
  useDocumentTitle(title);
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card padding="none">
        <EmptyState
          size="page"
          icon={<Icon className="size-7" />}
          title="Coming in the next build"
          description={`${title} is being built. Its route, navigation and permissions are already in place.`}
          action={children}
        />
      </Card>
    </>
  );
}
