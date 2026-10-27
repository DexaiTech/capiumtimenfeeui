import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';

import { Dropdown, type DropdownItem } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface OverflowNavItem {
  id: string;
  label: string;
  to: string;
  icon?: LucideIcon;
  /** Groups the item under a heading once it falls into the "More" menu. */
  group?: string;
}

export interface OverflowNavProps {
  /** Accessible name of the `<nav>`. */
  label: string;
  items: ReadonlyArray<OverflowNavItem>;
  /** The item that is current; it always stays visible, never folded into "More". */
  activeId: string | null;
  /** `topbar`: white text on the violet bar. `subnav`: the white secondary bar. */
  variant: 'topbar' | 'subnav';
  className?: string;
}

/** The gap between items: the top bar packs its modules tighter. */
const gapFor = (variant: OverflowNavProps['variant']) => (variant === 'topbar' ? 2 : 4);
/** Room kept for the "More" button when some items do not fit. */
const MORE_PX = 84;

const itemClasses = (variant: OverflowNavProps['variant'], active: boolean) =>
  cn(
    'inline-flex h-8 items-center rounded-[5px] text-xs font-medium whitespace-nowrap',
    variant === 'topbar' ? 'gap-[5px] px-[7px]' : 'gap-1.5 px-2.5',
    'transition-colors duration-fast ease-standard',
    variant === 'topbar'
      ? active
        ? 'bg-topbar-pill text-topbar-fg shadow-[inset_0_-2px_0_0_var(--color-gold)]'
        : 'text-topbar-muted hover:bg-topbar-hover hover:text-topbar-fg'
      : active
        ? 'bg-brand-soft text-brand-text'
        : 'text-text-muted hover:bg-surface-hover hover:text-text',
  );

/**
 * How many leading items fit in the container. Items are measured in a hidden copy of the
 * list, so the result does not depend on which ones are currently shown. Where nothing can
 * be measured (a test DOM, a hidden bar) every item counts as fitting.
 */
function useFitCount(itemKey: string, total: number, gap: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState(total);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const update = () => {
      const available = container.clientWidth;
      const widths = Array.from(measure.children, (child) => (child as HTMLElement).offsetWidth);
      if (available === 0 || widths.every((width) => width === 0)) {
        setFit(widths.length);
        return;
      }
      const all = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
      if (all <= available) {
        setFit(widths.length);
        return;
      }
      let used = MORE_PX;
      let count = 0;
      for (const width of widths) {
        if (used + width + gap > available) break;
        used += width + gap;
        count += 1;
      }
      setFit(Math.max(1, count));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [itemKey, total, gap]);

  return { containerRef, measureRef, fit: Math.min(fit, total) };
}

/**
 * A horizontal list of links that folds what does not fit into a "More" menu, keeping the
 * current item visible. Used for the modules of the top bar and the pages of the secondary bar.
 */
export function OverflowNav({ label, items, activeId, variant, className }: OverflowNavProps) {
  const navigate = useNavigate();
  const itemKey = useMemo(() => items.map((item) => item.id).join('|'), [items]);
  const gap = gapFor(variant);
  const { containerRef, measureRef, fit } = useFitCount(itemKey, items.length, gap);

  const shown = items.slice(0, fit);
  const active = items.find((item) => item.id === activeId);
  if (active && !shown.includes(active) && shown.length > 0) shown[shown.length - 1] = active;
  const hidden = items.filter((item) => !shown.includes(item));

  const renderLink = (item: OverflowNavItem, current: boolean) => {
    const Icon = item.icon;
    return (
      <Link
        to={item.to}
        aria-current={current ? 'page' : undefined}
        className={itemClasses(variant, current)}
      >
        {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
        {item.label}
      </Link>
    );
  };

  // Hidden items are grouped under a heading when they carry one (Settings does; other
  // modules' items have no `group` and render exactly as before, flat with no headings).
  const moreItems: DropdownItem[] = [];
  let lastGroup: string | undefined;
  for (const item of hidden) {
    if (item.group !== lastGroup) {
      if (item.group) moreItems.push({ id: `group-${item.group}`, heading: item.group });
      lastGroup = item.group;
    }
    const Icon = item.icon;
    moreItems.push({
      id: item.id,
      label: item.label,
      icon: Icon ? <Icon aria-hidden="true" className="size-4 text-text-muted" /> : undefined,
      onSelect: () => void navigate(item.to),
    });
  }

  const hiddenStyle: CSSProperties = {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    height: 0,
    overflow: 'hidden',
  };

  return (
    <nav aria-label={label} className={cn('relative min-w-0', className)}>
      <div ref={containerRef} className="w-full min-w-0">
        <ul
          className={cn(
            'flex items-center',
            variant === 'subnav' ? 'justify-center' : 'justify-start',
          )}
          style={{ gap }}
        >
          {shown.map((item) => (
            <li key={item.id}>{renderLink(item, item.id === activeId)}</li>
          ))}
          {hidden.length > 0 ? (
            <li>
              <Dropdown
                label={`More ${label.toLowerCase()}`}
                align="end"
                items={moreItems}
                trigger={
                  <span className={itemClasses(variant, false)}>
                    More
                    <ChevronDown aria-hidden="true" className="size-3.5" />
                  </span>
                }
              />
            </li>
          ) : null}
        </ul>
      </div>
      <ul ref={measureRef} aria-hidden="true" style={{ ...hiddenStyle, gap }} className="flex">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <span className={itemClasses(variant, false)}>
              {item.icon ? <item.icon className="size-3.5 shrink-0" /> : null}
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
