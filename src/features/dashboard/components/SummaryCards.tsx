import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Link } from 'react-router';

import { Skeleton } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';

import { CARD_META, SECONDARY_LABEL } from '../constants';
import type { DashboardCard, DashboardCards, DashboardPeriod } from '../types';
import { comparisonLabel, describeChange, formatValue, practicePath } from '../utils/format';
import { WidgetError } from './WidgetStates';

function ChangeLine({ card, period }: { card: DashboardCard; period: DashboardPeriod }) {
  const { comparison } = card;
  if (!comparison) return null;
  const change = describeChange(comparison, card.unit);
  const { better } = CARD_META[card.key];
  const good =
    change.direction === 'flat' || better === 'neutral'
      ? null
      : (change.direction === 'up') === (better === 'up');
  const Icon = change.direction === 'up' ? ArrowUp : change.direction === 'down' ? ArrowDown : Minus;
  return (
    <p
      className={cn(
        'flex items-center gap-1 text-2xs font-medium',
        good === null ? 'text-text-muted' : good ? 'text-success' : 'text-danger',
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {change.direction === 'up' ? <span className="sr-only">Up</span> : null}
      {change.direction === 'down' ? <span className="sr-only">Down</span> : null}
      <span>
        {change.text} {comparisonLabel(comparison.basis, period)}
      </span>
    </p>
  );
}

function CardTile({ card, period }: { card: DashboardCard; period: DashboardPeriod }) {
  const { organization } = useOrg();
  const meta = CARD_META[card.key];
  const Icon = meta.icon;
  const to = practicePath(organization.slug, card.link);
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            meta.strong,
            meta.text,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-2xl leading-tight font-semibold text-text tabular-nums">
            {card.value === null ? '' : formatValue(card.value, card.unit)}
          </span>
          <span className="text-xs font-medium text-text-muted">{card.title}</span>
        </div>
      </div>
      <ChangeLine card={card} period={period} />
      {card.secondary ? (
        <p className="text-2xs text-text-muted">
          {SECONDARY_LABEL[card.secondary.key]}{' '}
          <span className="font-medium text-text tabular-nums">
            {formatValue(card.secondary.value, card.secondary.unit)}
          </span>
        </p>
      ) : null}
    </>
  );
  const className = cn(
    'flex h-full flex-col gap-2.5 rounded-xl p-4 transition-shadow duration-base ease-standard',
    meta.soft,
    to && 'hover:shadow-md focus-visible:shadow-md',
  );
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

const GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6';

export interface SummaryCardsProps {
  query: UseQueryResult<DashboardCards>;
}

/**
 * The summary cards of the dashboard: the figure, how it moved and where to read more. Only the
 * cards the caller's role includes are drawn; the cards load, fail and refresh as one widget.
 */
export function SummaryCards({ query }: SummaryCardsProps) {
  const { data } = query;
  if (!data) {
    if (query.isError) {
      return (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <WidgetError
            title="the summary cards"
            error={query.error}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        </div>
      );
    }
    return (
      <ul aria-busy="true" aria-label="Summary cards" className={GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} role="status" aria-label="Loading card">
            <Skeleton shape="rect" className="h-[104px] w-full" />
          </li>
        ))}
      </ul>
    );
  }
  const cards = data.cards.filter((card) => card.visible);
  if (cards.length === 0) return null;
  return (
    <ul aria-busy={query.isFetching || undefined} aria-label="Summary cards" className={GRID}>
      {cards.map((card) => (
        <li key={card.key} className="min-w-0">
          <CardTile card={card} period={data.period} />
        </li>
      ))}
    </ul>
  );
}
