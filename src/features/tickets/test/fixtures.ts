import { testUser } from '@/test/fixtures';

import type {
  Person,
  TagRef,
  TicketAttachment,
  TicketComment,
  TicketDashboard,
  TicketDetail,
  TicketListItem,
  TicketTag,
  TrendPoint,
} from '../types';

/**
 * The examples of `docs/modules/tickets.md` of the API as fixtures: the ticket APT1 with its
 * screenshot, the comment, the tags, and the dashboard of 1 to 30 September (16 tickets, 10 in
 * the previous period). A few records are added so that every state of the screens is reached.
 */
export { testUser };

const CREATED = '2026-10-18T02:53:47.804669Z';

/* --------------------------------- People --------------------------------- */

export const userOne: Person = {
  id: '01a14ced-fa33-77b2-9492-dd63f257b501',
  full_name: 'User 001',
};
export const bob: Person = { id: '01a14cf2-1da9-7523-bd2a-c28ed2e06449', full_name: 'Bob Brown' };
export const alice: Person = {
  id: '01a14cf2-1d93-763c-b637-77d98585eef3',
  full_name: 'Alice Adams',
};
/** The signed-in person of the tests: the author of the comments they may edit. */
export const ada: Person = { id: testUser.id, full_name: testUser.full_name };

/* ---------------------------------- Tags ---------------------------------- */

export const accountsTag: TagRef = {
  id: '01a14ced-fb43-726c-9041-6eaefccfa32c',
  name: 'Accounts',
  color: 'blue',
};
export const bugTag: TagRef = {
  id: '01a14ced-fb43-726c-9041-6eaa007888a8',
  name: 'Bug',
  color: 'red',
};
export const enhancementTag: TagRef = {
  id: '01a14ced-fb43-726c-9041-6eab2c1d0e55',
  name: 'Enhancement',
  color: 'violet',
};
export const reportingTag: TagRef = {
  id: '01a14ced-fb43-726c-9041-6eac4a7b9f10',
  name: 'Reporting',
  color: 'green',
};
export const securityTag: TagRef = {
  id: 'a337c66e-6a53-4188-851b-8cc6ec6b95fa',
  name: 'Security',
  color: 'red',
};
export const uiTag: TagRef = {
  id: '01a14ced-fb43-726c-9041-6ead91e2c3a8',
  name: 'UI',
  color: 'blue',
};

const tagRow = (tag: TagRef, ticketCount: number): TicketTag => ({
  ...tag,
  ticket_count: ticketCount,
  created_at: '2026-10-18T02:53:47.108786Z',
  updated_at: '2026-10-18T02:53:47.108786Z',
});

/** `GET /ticket-tags`: sorted by name ignoring case. */
export const testTags: TicketTag[] = [
  tagRow(accountsTag, 1),
  tagRow(bugTag, 2),
  tagRow(enhancementTag, 0),
  tagRow(reportingTag, 1),
  tagRow(securityTag, 1),
  tagRow(uiTag, 0),
];

/* --------------------------------- Tickets -------------------------------- */

const base = {
  category: 'application' as const,
  created_by: userOne.id,
  created_by_name: userOne.full_name,
  closed_at: null,
  comment_count: 0,
  attachment_count: 0,
  description_excerpt: null,
};

/** The `TicketListItem` of the API document. */
export const apt1: TicketListItem = {
  ...base,
  id: '01a14ced-fd9d-70a8-b218-74162d54b125',
  code: 'APT1',
  number: 1,
  subject: 'Trial balance does not agree',
  status: 'in_progress',
  priority: 'high',
  tags: [accountsTag, bugTag],
  assignee: userOne,
  created_at: CREATED,
  updated_at: CREATED,
  comment_count: 2,
  attachment_count: 3,
  description_excerpt:
    'The trial balance for year end shows a difference of GBP 12.50.\nSee the attached screenshot.',
};

/** Open, medium and untagged: "Add tags" shows in its row. */
export const apt2: TicketListItem = {
  ...base,
  id: '5d1f0c3a-4b7e-4c8a-9a52-2f6a1d0e7b21',
  code: 'APT2',
  number: 2,
  subject: 'Period lock message is unclear',
  status: 'open',
  priority: 'medium',
  tags: [],
  assignee: null,
  created_at: '2026-10-18T09:30:00Z',
  updated_at: '2026-10-18T09:30:00Z',
};

/** The first `recent` item of the dashboard example. */
export const apt16: TicketListItem = {
  ...base,
  id: '412c58f7-2f2c-464f-b6b3-9a7f8a7e377f',
  code: 'APT16',
  number: 16,
  subject: 'September 16',
  status: 'closed',
  priority: 'not_set',
  tags: [securityTag],
  assignee: bob,
  created_by: '01a14cf2-1c62-7197-b126-b4036663dad9',
  created_by_name: 'User 001',
  created_at: '2026-09-30T12:00:00Z',
  updated_at: '2026-10-18T02:58:18.570285Z',
  closed_at: '2026-09-30T18:00:00Z',
};

/** Open with two tags, created at 23:30 UTC on 29 September: already the 30th in London (UTC+1). */
export const apt15: TicketListItem = {
  ...base,
  id: '9b0e6c52-71d4-4f0a-8e3b-5c1a2d7f4e68',
  code: 'APT15',
  number: 15,
  subject: 'September 15',
  status: 'open',
  priority: 'low',
  tags: [bugTag, reportingTag],
  assignee: null,
  created_at: '2026-09-29T23:30:00Z',
  updated_at: '2026-09-29T23:30:00Z',
};

/** In the order of the list: newest first. */
export const testTickets: TicketListItem[] = [apt2, apt1, apt16];

/* ------------------------------- Attachments ------------------------------ */

/** The `Attachment` of the API document, on the ticket itself and uploaded by the signed-in person. */
export const screenshot: TicketAttachment = {
  id: '01a14ced-fe5d-71f8-a620-e9700fdbf375',
  ticket_id: apt1.id,
  comment_id: null,
  file_name: 'screenshot.png',
  content_type: 'image/png',
  size_bytes: 69,
  is_image: true,
  uploaded_by: ada.id,
  uploaded_by_name: ada.full_name,
  created_at: '2026-10-18T02:53:47.961895Z',
};

/** A file on the ticket uploaded by someone else. */
export const trialBalancePdf: TicketAttachment = {
  id: '01a14ced-fe5d-71f8-a620-e9700fdbf376',
  ticket_id: apt1.id,
  comment_id: null,
  file_name: 'trial-balance.pdf',
  content_type: 'application/pdf',
  size_bytes: 142_000,
  is_image: false,
  uploaded_by: userOne.id,
  uploaded_by_name: userOne.full_name,
  created_at: '2026-10-18T02:55:00Z',
};

/* -------------------------------- Comments -------------------------------- */

const ADA_COMMENT_ID = '01a14ced-fe8a-74be-b693-e59e17f1dff4';

/** A file that belongs to a comment: it shows in the comment and not among the ticket's own. */
export const differencesSheet: TicketAttachment = {
  id: '01a14ced-fe5d-71f8-a620-e9700fdbf377',
  ticket_id: apt1.id,
  comment_id: ADA_COMMENT_ID,
  file_name: 'differences.xlsx',
  content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size_bytes: 8800,
  is_image: false,
  uploaded_by: ada.id,
  uploaded_by_name: ada.full_name,
  created_at: '2026-10-18T02:53:47.99Z',
};

/** The `Comment` of the API document, written by the signed-in person. */
export const adaComment: TicketComment = {
  id: ADA_COMMENT_ID,
  ticket_id: apt1.id,
  author: ada,
  body: 'Reproduced on the demo practice.',
  edited_at: null,
  created_at: '2026-10-18T02:53:48.022114Z',
  attachments: [differencesSheet],
};

/** Written by someone else and edited since. */
export const bobComment: TicketComment = {
  id: '01a14ced-fe8a-74be-b693-e59e17f1dff5',
  ticket_id: apt1.id,
  author: bob,
  body: 'Same difference after the second client is selected.',
  edited_at: '2026-10-18T03:05:00Z',
  created_at: '2026-10-18T03:00:00Z',
  attachments: [],
};

export const testComments: TicketComment[] = [adaComment, bobComment];

/* ---------------------------------- Detail --------------------------------- */

/** The detail of a ticket: its list item without the excerpt, with the full text and the files. */
export function detailOf(
  ticket: TicketListItem,
  extra: { description?: string | null; attachments?: TicketAttachment[] } = {},
): TicketDetail {
  const { description_excerpt: excerpt, ...rest } = ticket;
  return {
    ...rest,
    description: extra.description === undefined ? excerpt : extra.description,
    attachments: extra.attachments ?? [],
  };
}

export const APT1_DESCRIPTION =
  'The trial balance for year end shows a difference of GBP 12.50.\nSee the attached screenshot.';

/** Every file of the ticket, the comments' too, oldest first. */
export const apt1Detail: TicketDetail = detailOf(apt1, {
  description: APT1_DESCRIPTION,
  attachments: [screenshot, trialBalancePdf, differencesSheet],
});

/** A ticket without a description, files or comments. */
export const apt2Detail: TicketDetail = detailOf(apt2, { description: null });

/* -------------------------------- Dashboard ------------------------------- */

const point = (
  date: string,
  open: number,
  hold: number,
  inProgress: number,
  reopen: number,
  closed: number,
): TrendPoint => ({
  date,
  open,
  hold,
  in_progress: inProgress,
  reopen,
  closed,
  total: open + hold + inProgress + reopen + closed,
});

/** The dataset of the API document: the 30 days 1 to 30 September (16 tickets, 10 before). */
export const testDashboard: TicketDashboard = {
  date_from: '2026-09-01',
  date_to: '2026-09-30',
  previous_from: '2026-08-02',
  previous_to: '2026-08-31',
  days: 30,
  kpis: {
    total: { value: 16, previous: 10, change: { kind: 'percent', percent: 60 } },
    open: { value: 6, previous: 4, change: { kind: 'percent', percent: 50 } },
    hold: { value: 2, previous: 0, change: { kind: 'new', percent: null } },
    in_progress: { value: 3, previous: 3, change: { kind: 'percent', percent: 0 } },
    reopen: { value: 1, previous: 2, change: { kind: 'percent', percent: -50 } },
    closed: { value: 4, previous: 1, change: { kind: 'percent', percent: 300 } },
  },
  by_status: [
    { status: 'open', count: 6, percent: 37.5 },
    { status: 'hold', count: 2, percent: 12.5 },
    { status: 'in_progress', count: 3, percent: 18.8 },
    { status: 'reopen', count: 1, percent: 6.3 },
    { status: 'closed', count: 4, percent: 25.0 },
  ],
  by_priority: [
    { priority: 'high', count: 4, percent: 25.0 },
    { priority: 'medium', count: 4, percent: 25.0 },
    { priority: 'low', count: 3, percent: 18.8 },
    { priority: 'not_set', count: 5, percent: 31.3 },
  ],
  by_tag: [
    {
      tag_id: '01a14cf2-1d74-715f-a7de-0ff6a8dd417d',
      name: 'Bug',
      color: 'red',
      count: 6,
      is_other: false,
    },
    {
      tag_id: '01a14cf2-1d74-715f-a7de-0ff968a62e4c',
      name: 'Reporting',
      color: 'green',
      count: 3,
      is_other: false,
    },
    {
      tag_id: '01a14cf2-1d74-715f-a7de-0ffa8555cc17',
      name: 'Accounts',
      color: 'blue',
      count: 2,
      is_other: false,
    },
    {
      tag_id: '2ced8f3a-a4c0-4140-9908-c83ab7ab2362',
      name: 'Docs',
      color: 'blue',
      count: 2,
      is_other: false,
    },
    {
      tag_id: '01a14cf2-1d74-715f-a7de-0ff7523cb6d2',
      name: 'Enhancement',
      color: 'violet',
      count: 2,
      is_other: false,
    },
    {
      tag_id: 'a337c66e-6a53-4188-851b-8cc6ec6b95fa',
      name: 'Security',
      color: 'red',
      count: 2,
      is_other: false,
    },
    {
      tag_id: '01a14cf2-1d74-715f-a7de-0ff8d2d01eb6',
      name: 'UI',
      color: 'blue',
      count: 2,
      is_other: false,
    },
    { tag_id: null, name: 'Others', color: null, count: 1, is_other: true },
  ],
  trend: [
    point('2026-09-17', 6, 2, 1, 0, 0),
    point('2026-09-18', 6, 2, 2, 0, 0),
    point('2026-09-19', 6, 2, 2, 0, 0),
    point('2026-09-20', 7, 2, 2, 0, 0),
    point('2026-09-21', 6, 2, 3, 0, 0),
    point('2026-09-22', 7, 2, 3, 0, 0),
    point('2026-09-23', 6, 2, 3, 0, 1),
    point('2026-09-24', 7, 2, 3, 0, 1),
    point('2026-09-25', 7, 2, 3, 1, 0),
    point('2026-09-26', 7, 2, 3, 1, 1),
    point('2026-09-27', 6, 2, 4, 1, 1),
    point('2026-09-28', 6, 2, 4, 1, 2),
    point('2026-09-29', 6, 2, 3, 1, 3),
    point('2026-09-30', 6, 2, 3, 1, 4),
  ],
  top_assignees: [
    { user_id: null, full_name: 'Unassigned', count: 5 },
    { user_id: alice.id, full_name: alice.full_name, count: 4 },
    { user_id: bob.id, full_name: bob.full_name, count: 4 },
    { user_id: '01a14cf2-1dbe-75f6-9cdf-e544f1d1deaf', full_name: 'Carol Clark', count: 3 },
  ],
  // The endpoint returns up to seven; the document shows the first.
  recent: [apt16, apt15],
};

/** A range with no ticket: zeros, every `change` "none", every `percent` null, nothing listed. */
export const emptyDashboard: TicketDashboard = {
  date_from: '2026-01-01',
  date_to: '2026-01-19',
  previous_from: '2025-12-13',
  previous_to: '2025-12-31',
  days: 19,
  kpis: {
    total: { value: 0, previous: 0, change: { kind: 'none', percent: null } },
    open: { value: 0, previous: 0, change: { kind: 'none', percent: null } },
    hold: { value: 0, previous: 0, change: { kind: 'none', percent: null } },
    in_progress: { value: 0, previous: 0, change: { kind: 'none', percent: null } },
    reopen: { value: 0, previous: 0, change: { kind: 'none', percent: null } },
    closed: { value: 0, previous: 0, change: { kind: 'none', percent: null } },
  },
  by_status: [
    { status: 'open', count: 0, percent: null },
    { status: 'hold', count: 0, percent: null },
    { status: 'in_progress', count: 0, percent: null },
    { status: 'reopen', count: 0, percent: null },
    { status: 'closed', count: 0, percent: null },
  ],
  by_priority: [
    { priority: 'high', count: 0, percent: null },
    { priority: 'medium', count: 0, percent: null },
    { priority: 'low', count: 0, percent: null },
    { priority: 'not_set', count: 0, percent: null },
  ],
  by_tag: [],
  trend: Array.from({ length: 14 }, (_, index) =>
    point(`2026-01-${String(index + 6).padStart(2, '0')}`, 0, 0, 0, 0, 0),
  ),
  top_assignees: [],
  recent: [],
};
