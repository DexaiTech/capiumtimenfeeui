import { ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout';
import { Card, EmptyState } from '@/components/ui';

export interface SettingsSectionProps {
  title: string;
  description?: ReactNode;
  /** The page's actions; at most one of them is primary. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Title, description, actions and content of one settings page. The shell provides the chrome. */
export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader title={title} description={description} actions={actions} className="mb-1" />
      {children}
    </section>
  );
}

export interface NoAccessProps {
  /** What the permission would show, for example "the audit log". */
  what: string;
}

/** Shown when the page is opened without the permission its endpoint requires. */
export function NoAccess({ what }: NoAccessProps) {
  return (
    <Card padding="none">
      <EmptyState
        icon={<ShieldOff className="size-6" />}
        title="You don't have access to this page"
        description={`Your role in this practice does not include viewing ${what}. Ask your practice administrator if you need it.`}
      />
    </Card>
  );
}
