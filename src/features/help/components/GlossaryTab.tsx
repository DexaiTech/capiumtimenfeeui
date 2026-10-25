import { Card } from '@/components/ui';

import { GLOSSARY } from '../flowData';

/** The words of the product, in plain language. */
export function GlossaryTab() {
  return (
    <Card padding="lg" role="region" aria-label="Glossary">
      <dl className="flex flex-col gap-3">
        {GLOSSARY.map((entry) => (
          <div key={entry.term} className="flex flex-col gap-0.5">
            <dt className="text-sm font-semibold text-text">{entry.term}</dt>
            <dd className="text-sm text-text-muted">{entry.meaning}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
