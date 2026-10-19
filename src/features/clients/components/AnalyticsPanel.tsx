import { ChartColumn } from 'lucide-react';
import { useRef, useState } from 'react';

import { Popover } from '@/components/ui';

import { AML_LABELS, CLIENT_STATUS_LABELS, labelOf } from '../constants';
import type { ClientSummary } from '../types';

export interface AnalyticsPanelProps {
  summary: ClientSummary | undefined;
  loading: boolean;
}

interface Bar {
  key: string;
  label: string;
  count: number;
}

function Bars({ title, bars }: { title: string; bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.count));
  return (
    <section aria-label={title}>
      <p className="cc-popover-title" style={{ paddingLeft: 0 }}>
        {title}
      </p>
      <ul className="cc-bars">
        {bars.map((bar) => (
          <li key={bar.key} className="cc-bar-row">
            <span>{bar.label}</span>
            <span className="cc-bar-track" aria-hidden="true">
              <span
                className="cc-bar-fill"
                style={{ display: 'block', width: `${(bar.count / max) * 100}%` }}
              />
            </span>
            <span className="cc-bar-value">{bar.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Analytics": the summary counts by status, segment and AML status. */
export function AnalyticsPanel({ summary, loading }: AnalyticsPanelProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="cc-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <ChartColumn aria-hidden="true" />
        Analytics
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Client analytics"
        align="end"
        className="capium-clients cc-popover"
      >
        <div className="cc-analytics">
          {loading || !summary ? (
            <p className="cc-empty-note">Loading the figures…</p>
          ) : (
            <>
              <div className="cc-analytics-total">
                <strong>{summary.total}</strong> clients (archived excluded) ·{' '}
                {summary.with_overdue_deadlines} with overdue deadlines
              </div>
              <Bars
                title="By status"
                bars={Object.entries(summary.by_status).map(([key, count]) => ({
                  key,
                  label: labelOf(CLIENT_STATUS_LABELS, key),
                  count,
                }))}
              />
              <Bars
                title="By segment"
                bars={summary.by_segment.map((entry) => ({
                  key: entry.segment ?? '__none',
                  label: entry.segment ?? 'No segment',
                  count: entry.count,
                }))}
              />
              <Bars
                title="By AML status"
                bars={Object.entries(summary.by_aml_status).map(([key, count]) => ({
                  key,
                  label: labelOf(AML_LABELS, key),
                  count,
                }))}
              />
            </>
          )}
        </div>
      </Popover>
    </>
  );
}
