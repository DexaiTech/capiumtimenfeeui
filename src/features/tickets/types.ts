import type { IsoDate, IsoDateTime } from '@/types/api';

/**
 * The shapes of the tickets API (`docs/modules/tickets.md` of the API): "Application Testing",
 * the practice's tracker for bugs and enhancements found while using the application.
 */

export type TicketStatus = 'open' | 'hold' | 'in_progress' | 'reopen' | 'closed';
export type TicketPriority = 'high' | 'medium' | 'low' | 'not_set';
/** Names of design-system tones: each maps to the badge tone of the same name. */
export type TagColor = 'violet' | 'blue' | 'green' | 'red' | 'orange' | 'grey';

export interface TagRef {
  id: string;
  name: string;
  color: TagColor;
}

export interface Person {
  id: string;
  full_name: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  /** Null for a file on the ticket itself, else the comment it belongs to. */
  comment_id: string | null;
  file_name: string;
  /** What the content really is (detected on upload). */
  content_type: string;
  size_bytes: number;
  /** True for `image/*`: show a thumbnail. */
  is_image: boolean;
  uploaded_by: string;
  uploaded_by_name: string | null;
  created_at: IsoDateTime;
}

/** One ticket of a list, and of `recent` on the dashboard. */
export interface TicketListItem {
  id: string;
  /** `APT271`: the code to show; address a ticket by `id`. */
  code: string;
  number: number;
  category: 'application';
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  tags: TagRef[];
  assignee: Person | null;
  created_by: string;
  created_by_name: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  closed_at: IsoDateTime | null;
  comment_count: number;
  attachment_count: number;
  description_excerpt: string | null;
}

export interface TicketDetail extends Omit<TicketListItem, 'description_excerpt'> {
  description: string | null;
  /** Sanitised HTML of the description; null for a plain-text one. */
  description_html?: string | null;
  /** Every file of the ticket (the comments' too), oldest first. */
  attachments: TicketAttachment[];
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author: Person;
  body: string;
  /** Sanitised HTML of the comment; null for a plain-text one. */
  body_html?: string | null;
  edited_at: IsoDateTime | null;
  created_at: IsoDateTime;
  attachments: TicketAttachment[];
}

export interface TicketTag {
  id: string;
  name: string;
  color: TagColor;
  ticket_count: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export type TicketSort = 'created_at' | 'number' | 'subject' | 'status' | 'priority';
export type SortOrder = 'asc' | 'desc';

/** What the list is asked for; empty arrays and a blank `q` mean "no filter". */
export interface TicketFilters {
  q?: string;
  status: TicketStatus[];
  priority: TicketPriority[];
  tag_id: string[];
  sort: TicketSort;
  order: SortOrder;
}

export interface TicketCreate {
  subject: string;
  description?: string | null;
  /** The editor's HTML; the API sanitises it and derives `description` from it. */
  description_html?: string | null;
  status?: TicketStatus;
  priority?: TicketPriority;
  tag_ids?: string[];
  assignee_id?: string | null;
}

/** PATCH body: any subset. */
export interface TicketUpdate {
  subject?: string;
  description?: string | null;
  description_html?: string | null;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee_id?: string | null;
  tag_ids?: string[];
}

export type BulkAction = 'set_status' | 'set_priority' | 'add_tag' | 'remove_tag' | 'delete';

export interface BulkRequest {
  ticket_ids: string[];
  action: BulkAction;
  /** A status, a priority or a tag id; absent for `delete`. */
  value?: string;
}

export interface BulkResult {
  action: BulkAction;
  affected: number;
  changed: number;
}

export interface TagCreate {
  name: string;
  color?: TagColor;
}

/* --------------------------------- Dashboard -------------------------------- */

export interface Change {
  kind: 'new' | 'percent' | 'none';
  percent: number | null;
}

export interface Kpi {
  value: number;
  previous: number;
  change: Change;
}

export type KpiKey = 'total' | TicketStatus;

export interface StatusShare {
  status: TicketStatus;
  count: number;
  /** One decimal, half up; null when the range holds no ticket. */
  percent: number | null;
}

export interface PriorityShare {
  priority: TicketPriority;
  count: number;
  percent: number | null;
}

export interface TagCount {
  tag_id: string | null;
  name: string;
  color: TagColor | null;
  count: number;
  /** The final "Others" row. */
  is_other: boolean;
}

export type TrendPoint = { date: IsoDate; total: number } & Record<TicketStatus, number>;

export interface AssigneeCount {
  user_id: string | null;
  full_name: string;
  count: number;
}

export interface TicketDashboard {
  date_from: IsoDate;
  date_to: IsoDate;
  previous_from: IsoDate;
  previous_to: IsoDate;
  days: number;
  kpis: Record<KpiKey, Kpi>;
  by_status: StatusShare[];
  by_priority: PriorityShare[];
  by_tag: TagCount[];
  trend: TrendPoint[];
  top_assignees: AssigneeCount[];
  recent: TicketListItem[];
}

/** The range the dashboard is asked for; both ends absent means the API's default (19 days). */
export interface DashboardRange {
  date_from?: IsoDate;
  date_to?: IsoDate;
}
