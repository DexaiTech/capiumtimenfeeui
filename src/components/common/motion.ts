import type { Transition, Variants } from 'motion/react';

/**
 * Shared animation variants. Components do not define their own timings.
 * The numbers mirror the motion tokens in styles/theme.css (Motion needs them in JS):
 * --duration-fast 120ms, --duration-base 200ms, --duration-slow 320ms and the three easings.
 * Reduced motion is handled once by the root <MotionConfig reducedMotion="user">.
 */
export const durations = { fast: 0.12, base: 0.2, slow: 0.32 } as const;

export const easings = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1.1],
  exit: [0.4, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

const enter: Transition = { duration: durations.base, ease: easings.standard };
const leave: Transition = { duration: durations.fast, ease: easings.exit };

/** Route outlet: fade with a 4 px rise. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: enter },
};

/** Modal backdrop. */
export const backdrop: Variants = {
  hidden: { opacity: 0, transition: leave },
  visible: { opacity: 1, transition: enter },
};

/** Modal panel: scale from 0.98 and fade. */
export const modal: Variants = {
  hidden: { opacity: 0, scale: 0.98, transition: leave },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.base, ease: easings.emphasized },
  },
};

/** Bottom sheet (modals on small screens): slide on the vertical axis. */
export const sheet: Variants = {
  hidden: { opacity: 0, y: 32, transition: leave },
  visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.standard } },
};

/** Sidebar drawer: slide on the horizontal axis. */
export const drawer: Variants = {
  hidden: { x: '-100%', transition: { duration: durations.base, ease: easings.exit } },
  visible: { x: 0, transition: { duration: durations.slow, ease: easings.standard } },
};

/** Menus and tooltips. */
export const popover: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: -4, transition: leave },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: durations.fast, ease: easings.standard },
  },
};

const STAGGER_SECONDS = 0.03;
const STAGGER_CAP = 12;

/** Grid cards: fade and rise, staggered by 30 ms, capped at 12 items. Pass the index as `custom`. */
export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...enter, delay: Math.min(index, STAGGER_CAP) * STAGGER_SECONDS },
  }),
};

/** Short lists: height and opacity on add and remove. */
export const listItem: Variants = {
  hidden: { opacity: 0, height: 0, transition: leave },
  visible: { opacity: 1, height: 'auto', transition: enter },
};

/** Toasts: slide in from the edge, fade out. */
export const toast: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: durations.base, ease: easings.emphasized } },
  exit: { opacity: 0, transition: leave },
};

/** Attachment tray items: scale in, collapse on remove. */
export const attachment: Variants = {
  hidden: { opacity: 0, scale: 0.94, transition: leave },
  visible: { opacity: 1, scale: 1, transition: enter },
};
