import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { useShellStore } from '@/app/store';
import { Modal } from '@/components/ui';
import { cn } from '@/utils/cn';

import { useShell } from './shellContext';

interface Destination {
  id: string;
  label: string;
  /** Where it sits, for example "Billing". */
  group: string;
  icon: LucideIcon;
  to: string;
}

/** Every page the caller may open, and the quick-create shortcuts, as search results. */
function useDestinations(): Destination[] {
  const { practice, modules, quickCreate, applicationTesting } = useShell();
  return useMemo(() => {
    if (!practice) return [];
    const list: Destination[] = [];
    for (const module of modules) {
      list.push({
        id: module.id,
        label: module.label,
        group: 'Go to',
        icon: module.icon,
        to: module.href,
      });
      for (const entry of module.pages) {
        list.push({
          id: `${module.id}/${entry.id}`,
          label: entry.label,
          group: module.label,
          icon: entry.icon,
          to: entry.to(practice.slug),
        });
      }
    }
    const [firstPage] = applicationTesting?.pages ?? [];
    if (applicationTesting && firstPage) {
      list.push({
        id: 'application-testing',
        label: applicationTesting.label,
        group: 'Go to',
        icon: applicationTesting.icon,
        to: firstPage.to,
      });
      for (const entry of applicationTesting.pages) {
        list.push({
          id: `application-testing/${entry.id}`,
          label: entry.label,
          group: applicationTesting.label,
          icon: entry.icon,
          to: entry.to,
        });
      }
    }
    for (const item of quickCreate) {
      list.push({
        id: `create/${item.id}`,
        label: item.label,
        group: 'Create',
        icon: item.icon,
        to: item.to,
      });
    }
    return list;
  }, [practice, modules, quickCreate, applicationTesting]);
}

function matches(destination: Destination, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${destination.group} ${destination.label}`.toLowerCase().includes(needle);
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const destinations = useDestinations();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const results = destinations.filter((destination) => matches(destination, query));
  const active = results[Math.min(activeIndex, results.length - 1)];

  const go = (destination: Destination | undefined) => {
    if (!destination) return;
    onClose();
    void navigate(destination.to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(active);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
        />
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-label="Search pages"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
          placeholder="Search pages, for example invoices or timesheet"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-base text-text focus-visible:border-primary md:text-sm"
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Pages" className="max-h-80 overflow-y-auto">
        {results.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-text-muted">
            No page matches “{query.trim()}”.
          </li>
        ) : (
          results.map((destination) => {
            const Icon = destination.icon;
            const selected = destination.id === active?.id;
            return (
              <li
                key={destination.id}
                id={`${listId}-${destination.id}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(results.indexOf(destination))}
                onClick={() => go(destination)}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm',
                  selected ? 'bg-brand-soft text-text' : 'text-text',
                )}
              >
                <Icon aria-hidden="true" className="size-4 text-text-muted" />
                <span className="flex-1 truncate font-medium">{destination.label}</span>
                <span className="text-xs text-text-subtle">{destination.group}</span>
                {selected ? (
                  <CornerDownLeft aria-hidden="true" className="size-3.5 text-text-subtle" />
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/** Search over the pages of the practice; opened by the top-bar button, the "/" key or Ctrl/Cmd+K. */
export function SearchDialog() {
  const open = useShellStore((state) => state.searchOpen);
  const setSearchOpen = useShellStore((state) => state.setSearchOpen);
  const { practice } = useShell();

  useEffect(() => {
    if (!practice) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      // Cmd/Ctrl+K opens the search from anywhere, even from a field; "/" only outside fields.
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [practice, setSearchOpen]);

  return (
    <Modal open={open} onClose={() => setSearchOpen(false)} title="Search">
      {open ? <SearchPanel onClose={() => setSearchOpen(false)} /> : null}
    </Modal>
  );
}
