import {
  Ban,
  Bug,
  Check,
  ClipboardCheck,
  ClipboardList,
  Cog,
  MessageCircleQuestion,
  OctagonX,
  Pause,
  RotateCcw,
  Target,
  type LucideIcon,
} from 'lucide-react';

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
  'in_progress',
  'requirement_pending',
  'clarification_required',
  'blocked',
  'ready_for_ba_review',
  'reopened',
  'closed',
  'invalid',
  'on_hold',
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
const BLUE: ToneClasses = {
  text: 'text-badge-blue',
  soft: 'bg-badge-blue-soft',
  strong: 'bg-badge-blue/15',
};
const INDIGO: ToneClasses = {
  text: 'text-tag-indigo',
  soft: 'bg-tag-indigo/10',
  strong: 'bg-tag-indigo/15',
};
const BRONZE: ToneClasses = {
  text: 'text-badge-bronze',
  soft: 'bg-badge-bronze-soft',
  strong: 'bg-badge-bronze/15',
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
  open: { label: 'Open', tone: ORANGE, chart: 'orange' },
  in_progress: { label: 'In Progress', tone: BLUE, chart: 'blue' },
  requirement_pending: { label: 'Requirement Pending', tone: AMBER, chart: 'amber' },
  clarification_required: { label: 'Clarification Required', tone: VIOLET, chart: 'violet' },
  blocked: { label: 'Blocked', tone: RED, chart: 'danger' },
  ready_for_ba_review: { label: 'Ready for BA Review', tone: INDIGO, chart: 'indigo' },
  reopened: { label: 'Reopened', tone: RED, chart: 'pink' },
  closed: { label: 'Closed', tone: GREEN, chart: 'success' },
  invalid: { label: 'Invalid', tone: GREY, chart: 'muted' },
  on_hold: { label: 'On Hold', tone: BRONZE, chart: 'slate' },
};

/** What each status is for, shown as a hint where a person picks one. */
export const STATUS_HINTS: Record<TicketStatus, string> = {
  open: 'Newly created ticket',
  in_progress: 'Developer is working on it',
  requirement_pending: 'Waiting for BA to provide requirements or acceptance criteria',
  clarification_required: 'A question needs an answer from BA or developer',
  blocked: 'Work cannot proceed due to a dependency',
  ready_for_ba_review: 'Development completed; BA verification is pending',
  reopened: 'Issue returned for further work',
  closed: 'Work completed and accepted',
  invalid: 'Incorrect, duplicate, or out-of-scope ticket',
  on_hold: 'Work intentionally paused',
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

/** The cards of the dashboard, in order: the total, then one per status. */
export const KPI_CARDS: ReadonlyArray<{
  key: KpiKey;
  label: string;
  tone: ToneClasses;
  icon: LucideIcon;
}> = [
  { key: 'total', label: 'Total Tickets', tone: VIOLET, icon: Bug },
  { key: 'open', label: STATUS_META.open.label, tone: STATUS_META.open.tone, icon: Target },
  {
    key: 'in_progress',
    label: STATUS_META.in_progress.label,
    tone: STATUS_META.in_progress.tone,
    icon: Cog,
  },
  {
    key: 'requirement_pending',
    label: STATUS_META.requirement_pending.label,
    tone: STATUS_META.requirement_pending.tone,
    icon: ClipboardList,
  },
  {
    key: 'clarification_required',
    label: STATUS_META.clarification_required.label,
    tone: STATUS_META.clarification_required.tone,
    icon: MessageCircleQuestion,
  },
  {
    key: 'blocked',
    label: STATUS_META.blocked.label,
    tone: STATUS_META.blocked.tone,
    icon: OctagonX,
  },
  {
    key: 'ready_for_ba_review',
    label: STATUS_META.ready_for_ba_review.label,
    tone: STATUS_META.ready_for_ba_review.tone,
    icon: ClipboardCheck,
  },
  {
    key: 'reopened',
    label: STATUS_META.reopened.label,
    tone: STATUS_META.reopened.tone,
    icon: RotateCcw,
  },
  { key: 'closed', label: STATUS_META.closed.label, tone: STATUS_META.closed.tone, icon: Check },
  { key: 'invalid', label: STATUS_META.invalid.label, tone: STATUS_META.invalid.tone, icon: Ban },
  {
    key: 'on_hold',
    label: STATUS_META.on_hold.label,
    tone: STATUS_META.on_hold.tone,
    icon: Pause,
  },
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
