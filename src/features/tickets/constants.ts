import { Bug, Check, Cog, Pause, RotateCcw, Target, type LucideIcon } from 'lucide-react';

import type { ChartColor } from '@/components/charts';
import type { BadgeTone } from '@/components/ui';

import type {
  KpiKey,
  TagColor,
  TicketPriority,
  TicketSort,
  TicketStatus,
  SortOrder,
} from './types';

/** Statuses in the order lists, charts and menus use. Any status may follow any other. */
export const TICKET_STATUSES: ReadonlyArray<TicketStatus> = [
  'open',
  'hold',
  'in_progress',
  'reopen',
  'closed',
];

/** Priorities in the order charts and menus use. */
export const TICKET_PRIORITIES: ReadonlyArray<TicketPriority> = [
  'high',
  'medium',
  'low',
  'not_set',
];

/** The sorts the API offers; the tags column is not sortable. */
export const TICKET_SORTS: ReadonlyArray<TicketSort> = [
  'created_at',
  'number',
  'subject',
  'status',
  'priority',
];

/** The order the API uses for a sort when none is given (newest first for dates and numbers). */
export const defaultOrder = (sort: TicketSort): SortOrder =>
  sort === 'created_at' || sort === 'number' ? 'desc' : 'asc';

/**
 * The classes of one tone, all from the colour tokens (so the dark theme follows): the text and
 * dot colour, a 10% tint for pills and cards, a stronger tint for the icon badge of a card.
 */
export interface ToneClasses {
  text: string;
  soft: string;
  strong: string;
}

const AMBER: ToneClasses = {
  text: 'text-badge-amber',
  soft: 'bg-badge-amber-soft',
  strong: 'bg-badge-amber/15',
};
const ORANGE: ToneClasses = {
  text: 'text-tag-orange',
  soft: 'bg-tag-orange/10',
  strong: 'bg-tag-orange/15',
};
const CYAN: ToneClasses = {
  text: 'text-accent',
  soft: 'bg-accent-soft',
  strong: 'bg-accent/15',
};
const RED: ToneClasses = {
  text: 'text-badge-red',
  soft: 'bg-badge-red-soft',
  strong: 'bg-badge-red/15',
};
const GREEN: ToneClasses = {
  text: 'text-badge-green',
  soft: 'bg-badge-green-soft',
  strong: 'bg-badge-green/15',
};
const VIOLET: ToneClasses = {
  text: 'text-badge-violet',
  soft: 'bg-badge-violet-soft',
  strong: 'bg-badge-violet/15',
};
const GREY: ToneClasses = {
  text: 'text-badge-grey',
  soft: 'bg-badge-grey-soft',
  strong: 'bg-badge-grey/15',
};

export interface StatusMeta {
  label: string;
  tone: ToneClasses;
  /** The colour of its slice, bar and line in the charts. */
  chart: ChartColor;
}

export const STATUS_META: Record<TicketStatus, StatusMeta> = {
  open: { label: 'Open', tone: AMBER, chart: 'warning' },
  hold: { label: 'Hold', tone: ORANGE, chart: 'orange' },
  in_progress: { label: 'In Progress', tone: CYAN, chart: 'accent' },
  reopen: { label: 'Reopen', tone: RED, chart: 'danger' },
  closed: { label: 'Closed', tone: GREEN, chart: 'success' },
};

export interface PriorityMeta {
  label: string;
  tone: ToneClasses;
  chart: ChartColor;
}

export const PRIORITY_META: Record<TicketPriority, PriorityMeta> = {
  high: { label: 'High', tone: RED, chart: 'danger' },
  medium: { label: 'Medium', tone: ORANGE, chart: 'orange' },
  low: { label: 'Low', tone: GREEN, chart: 'success' },
  not_set: { label: 'Not Set', tone: GREY, chart: 'muted' },
};

/** The six cards of the dashboard, in order, with their tint and icon. */
export const KPI_CARDS: ReadonlyArray<{
  key: KpiKey;
  label: string;
  tone: ToneClasses;
  icon: LucideIcon;
}> = [
  { key: 'total', label: 'Total Tickets', tone: VIOLET, icon: Bug },
  { key: 'open', label: 'Open', tone: AMBER, icon: Target },
  { key: 'hold', label: 'Hold', tone: ORANGE, icon: Pause },
  { key: 'in_progress', label: 'In Progress', tone: CYAN, icon: Cog },
  { key: 'reopen', label: 'Reopen', tone: RED, icon: RotateCcw },
  { key: 'closed', label: 'Closed', tone: GREEN, icon: Check },
];

/** A tag's colour name is the badge tone of the same name. */
export const TAG_TONES: Record<TagColor, BadgeTone> = {
  violet: 'violet',
  blue: 'blue',
  green: 'green',
  red: 'red',
  orange: 'orange',
  grey: 'grey',
};

/** The dot that stands for a tag's colour in a picker (a token each). */
export const TAG_DOTS: Record<TagColor, string> = {
  violet: 'bg-badge-violet',
  blue: 'bg-badge-blue',
  green: 'bg-badge-green',
  red: 'bg-badge-red',
  orange: 'bg-badge-orange',
  grey: 'bg-badge-grey',
};

/** A tag's colour in the charts (the "by tag" bars). */
export const TAG_CHART_COLORS: Record<TagColor, ChartColor> = {
  violet: 'violet',
  blue: 'blue',
  green: 'green',
  red: 'red',
  orange: 'orange',
  grey: 'muted',
};

/** The category badge on the detail page ("Application"). */
export const CATEGORY_LABELS = { application: 'Application' } as const;

/**
 * The button that raises a ticket says "Application Testing" (the name of the tracker); its
 * accessible name adds what it does, so it is not mistaken for the bug button of the top bar
 * (the visible words stay inside it, as voice control needs).
 */
export const NEW_TICKET_BUTTON_NAME = 'Application Testing: new ticket';

/** A comment's text may hold at most this many characters (the API refuses more). */
export const COMMENT_MAX_LENGTH = 5000;
export const SUBJECT_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 10_000;
export const TAG_NAME_MAX_LENGTH = 40;
