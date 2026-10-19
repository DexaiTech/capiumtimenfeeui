import { ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { useShellStore } from '@/app/store';
import { LogoMark } from '@/components/common/Logo';
import { backdrop, drawer } from '@/components/common/motion';
import { Button } from '@/components/ui';
import { useFocusTrap } from '@/components/ui/useFocusTrap';
import { activePageId, moduleIdForPath } from '@/constants/navigation';
import { ORG_SEGMENTS } from '@/constants/routes';
import { cn } from '@/utils/cn';

import { useShell } from './shellContext';

const TRACKER_GROUP = 'application-testing';

const linkClasses = (active: boolean) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium',
    'transition-colors duration-fast ease-standard',
    active ? 'bg-brand-soft text-brand-text' : 'text-text hover:bg-surface-hover',
  );

function DrawerPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { practice, modules, applicationTesting } = useShell();
  const { pathname } = useLocation();
  const activeId = moduleIdForPath(pathname);
  const inTracker = pathname.split('/')[2] === ORG_SEGMENTS.applicationTesting;
  // One module is open at a time: the one the caller is in.
  const [openId, setOpenId] = useState<string | null>(inTracker ? TRACKER_GROUP : activeId);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <motion.div
        variants={backdrop}
        initial="hidden"
        animate="visible"
        exit="hidden"
        aria-hidden="true"
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        variants={drawer}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col bg-surface shadow-lg"
      >
        <div className="flex h-15 items-center justify-between gap-3 bg-topbar px-4 text-topbar-fg">
          <span className="flex min-w-0 items-center gap-2.5">
            <LogoMark tone="inverse" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold">{practice?.name ?? 'Capium'}</span>
              <span className="eyebrow text-topbar-subtle">Practice management</span>
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={onClose}
            className="text-topbar-fg hover:bg-topbar-hover hover:text-topbar-fg"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3 pb-safe">
          <ul className="flex flex-col gap-1">
            {modules.map((module) => {
              const Icon = module.icon;
              const active = module.id === activeId;
              const expanded = openId === module.id;
              const currentPage = active ? activePageId(module, pathname) : null;
              return (
                <li key={module.id}>
                  {module.pages.length < 2 ? (
                    <NavLink to={module.href} onClick={onClose} className={linkClasses(active)}>
                      <Icon aria-hidden="true" className="size-4.5" />
                      {module.label}
                    </NavLink>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setOpenId(expanded ? null : module.id)}
                        className={cn(linkClasses(active), 'w-full justify-start font-semibold')}
                      >
                        <Icon aria-hidden="true" className="size-4.5" />
                        <span className="flex-1 text-left">{module.label}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            'size-4 text-text-subtle transition-transform duration-fast',
                            expanded && 'rotate-180',
                          )}
                        />
                      </button>
                      {expanded ? (
                        <ul className="mb-2 ml-5 flex flex-col gap-0.5 border-l border-border pl-3">
                          {module.pages.map((item) => (
                            <li key={item.id}>
                              <NavLink
                                to={practice ? item.to(practice.slug) : '#'}
                                onClick={onClose}
                                aria-current={item.id === currentPage ? 'page' : undefined}
                                className={linkClasses(item.id === currentPage)}
                              >
                                {item.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
            {applicationTesting ? (
              <li key={TRACKER_GROUP}>
                <button
                  type="button"
                  aria-expanded={openId === TRACKER_GROUP}
                  onClick={() => setOpenId(openId === TRACKER_GROUP ? null : TRACKER_GROUP)}
                  className={cn(linkClasses(inTracker), 'w-full justify-start font-semibold')}
                >
                  <applicationTesting.icon aria-hidden="true" className="size-4.5" />
                  <span className="flex-1 text-left">{applicationTesting.label}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-4 text-text-subtle transition-transform duration-fast',
                      openId === TRACKER_GROUP && 'rotate-180',
                    )}
                  />
                </button>
                {openId === TRACKER_GROUP ? (
                  <ul className="mb-2 ml-5 flex flex-col gap-0.5 border-l border-border pl-3">
                    {applicationTesting.pages.map((item) => (
                      <li key={item.id}>
                        <NavLink
                          to={item.to}
                          onClick={onClose}
                          className={({ isActive }) => linkClasses(isActive)}
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ) : null}
          </ul>
        </nav>
      </motion.div>
    </div>
  );
}

/** The navigation drawer below the lg breakpoint. Traps focus, closes on Escape and on navigation. */
export function MobileDrawer() {
  const open = useShellStore((state) => state.drawerOpen);
  const setDrawerOpen = useShellStore((state) => state.setDrawerOpen);

  return (
    <AnimatePresence>
      {open ? <DrawerPanel key="drawer" onClose={() => setDrawerOpen(false)} /> : null}
    </AnimatePresence>
  );
}
