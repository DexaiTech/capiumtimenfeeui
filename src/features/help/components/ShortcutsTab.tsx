import { Card } from '@/components/ui';

import { SHORTCUTS } from '../flowData';

export function ShortcutsTab() {
  return (
    <Card padding="lg" role="region" aria-label="Keyboard shortcuts">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="contents">
            <dt>
              <kbd className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-xs text-text">
                {shortcut.keys}
              </kbd>
            </dt>
            <dd className="text-sm text-text-muted">{shortcut.does}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
