import { cn } from '@/utils/cn';

/** One item of a left sidebar (a module's pages, the sections of a client's settings). */
export const sidebarLinkClasses = (active: boolean, tone: 'default' | 'danger' = 'default') =>
  cn(
    'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap',
    'transition-colors duration-fast ease-standard',
    active
      ? 'bg-brand-soft text-brand-text shadow-[inset_3px_0_0_0_var(--module-accent,var(--color-brand))]'
      : tone === 'danger'
        ? 'text-danger hover:bg-danger/10'
        : 'text-text-muted hover:bg-surface-hover hover:text-text',
  );

/** The panel around a left sidebar: beside the content from lg up, a row of tabs below. */
export const SIDEBAR_PANEL_CLASSES =
  'shrink-0 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 shadow-card lg:sticky lg:top-20 lg:self-start lg:p-2';
