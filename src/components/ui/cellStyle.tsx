import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { Badge, type BadgeTone } from './Badge';
import { InitialsAvatar } from './InitialsAvatar';

/** Columns whose plain-text values are categories: shown as coloured pills. */
const CATEGORY_HEADER =
  /^(status|state|type|kind|priority|frequency|segment|basis|billing(?: type| basis| status)?|method|stage|level|category|role|grade|source|channel|outcome|result|tier|client type|job type|service type|activity(?: type)?|entity|bucket|rating|risk|aml|plan|service|activity code|vat code|expense type|result|action|template|channel|event|entity type|record|decision|movement|kind of wip|kind of work|wip kind|approval)$/i;

/** Columns that name a client: the avatar and the strong upper-case name of the Clients grid. */
const CLIENT_HEADER = /^(client|client name|customer)$/i;

/** Columns whose plain-text values are people: shown with a coloured avatar. */
const PERSON_HEADER =
  /^(assignee|assigned to|manager|partner|approver|owner|staff|person|user|member|created by|entered by|by|reviewer|requested by|submitted by|actor|responsible|preparer|who|staff member|team member|employee|approved by|decided by|sent by|updated by|prepared by|assigned|written by|recorded by)$/i;

const GOOD =
  /^(paid|approved|active|complete|completed|done|billed|clear|cleared|yes|enabled|on|sent|delivered|success|succeeded|current|open|available|reconciled|matched|filed|submitted ok|ok|live|connected)$/i;
const BAD =
  /^(overdue|rejected|failed|error|void|voided|cancelled|canceled|declined|blocked|lost|expired|disabled off|urgent|critical|written off|reversed|refused|late|dissolved)$/i;
const WARN =
  /^(draft|pending|due|due today|awaiting|awaiting approval|waiting|on hold|paused|partial|part paid|part-paid|high|unbilled|in draft|review|needs attention|warning)$/i;
const INFO =
  /^(submitted|in progress|issued|processing|running|started|normal|medium|scheduled|sending|queued|new|assigned|ready)$/i;
const QUIET =
  /^(none|closed|inactive|archived|not started|low|n\/a|na|unknown|never|no|off|left|removed|default|standard)$/i;

const HASHED: ReadonlyArray<BadgeTone> = ['violet', 'blue', 'orange', 'green', 'bronze', 'amber'];

/** A colour for a category: the meaning of the word where it has one, else a steady pick. */
export function toneOfText(text: string): BadgeTone {
  const word = text.trim();
  if (BAD.test(word)) return 'red';
  if (GOOD.test(word)) return 'green';
  if (WARN.test(word)) return 'amber';
  if (INFO.test(word)) return 'blue';
  if (QUIET.test(word)) return 'grey';
  let hash = 0;
  for (const char of word.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return HASHED[hash % HASHED.length] ?? 'violet';
}

const EMPTY = /^[\s—–-]*$/;

/** Figure columns and the colour their value is drawn in (when there is something to show). */
const FIGURE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  // Money owed, aged or lost.
  [
    /^(balance|outstanding|overdue|amount due|owed|unpaid|written off|write-offs?|over 90 days|over 90|90\+ days|61.90 days|over 60 days)/i,
    'text-danger',
  ],
  // Money that came in or was earned.
  [
    /^(paid|received|credited|billed|profit|margin|on account|recovered|write-?ons?)/i,
    'text-success',
  ],
  // WIP by kind: time, fixed fee, expenses.
  [/^(time wip|time value|time at|time$)/i, 'text-info'],
  [/^(fixed fee)/i, 'text-brand-text'],
  [/^(expense wip|expenses?|disbursements?)$/i, 'text-warning'],
  // Hours.
  [/^(hours|logged|chargeable|capacity|billable hours|est\. hours)$/i, 'text-info'],
  // The headline amount of a row.
  [
    /^(total|gross|gross total|net total|total wip|wip value|wip|fee|value|amount)$/i,
    'text-brand-text',
  ],
];
/** An amount, hours or a count that is not zero; a leading minus makes it a loss. */
const FIGURE = /^(-?)[£$€]?\s?(\d[\d,]*(?:[.:]\d+)?)/;
const ZERO_FIGURE = /^-?[£$€]?\s?0+(?:[.:]0+)?(?!\d)/;
const LOSS_HEADER = /^(adjustment|difference|variance|write-?off|credit|amount|value)/i;

/**
 * The text of a plain cell: a string or a number, or a bare span around one or several
 * (`<span className="text-text">{money} ({share})</span>`).
 */
function plainText(content: ReactNode): string | null {
  const flat = (node: unknown): string | null => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) {
      const parts = node.map(flat);
      return parts.every((part) => part !== null) ? parts.join('') : null;
    }
    return null;
  };
  const direct = flat(content);
  if (direct !== null) return direct;
  if (isValidElement(content) && content.type === 'span') {
    const props = content.props as { children?: unknown; onClick?: unknown };
    if (!props.onClick) return flat(props.children);
  }
  return null;
}

/**
 * Plain text in a categorical column becomes a coloured pill, plain text in a people column gets a
 * coloured avatar, and amounts that mean something (owed, earned, the total) are coloured, so
 * every grid reads in colour. Anything a column already draws (a badge, a link, a figure with
 * markup) is left exactly as it is.
 */
export function styleCell(header: string, content: ReactNode): ReactNode {
  // A client's name that is a link keeps its link: it gains the avatar and the strong name.
  if (CLIENT_HEADER.test(header.trim()) && isValidElement(content) && content.type !== 'span') {
    const props = content.props as { children?: unknown; className?: string };
    if (typeof props.children === 'string' && props.children.length <= 80) {
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <InitialsAvatar name={props.children} size="sm" />
          {cloneElement(content as ReactElement<{ className?: string }>, {
            className: cn(
              props.className,
              'max-w-[140px] truncate text-xs font-semibold uppercase',
            ),
          })}
        </span>
      );
    }
  }
  const text = plainText(content);
  if (text === null || EMPTY.test(text)) return content;
  const title = header.trim();
  if (CLIENT_HEADER.test(title) && text.length <= 80 && /[A-Za-z]/.test(text)) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <InitialsAvatar name={text} size="sm" />
        <span className="max-w-[140px] truncate text-xs font-semibold text-text uppercase">
          {text}
        </span>
      </span>
    );
  }
  if (CATEGORY_HEADER.test(title) && text.length <= 32 && !/^[\d.,£$€%\s-]+$/.test(text)) {
    return (
      <Badge tone={toneOfText(text)} size="sm">
        {text}
      </Badge>
    );
  }
  if (PERSON_HEADER.test(title) && text.length <= 60 && /[A-Za-z]/.test(text)) {
    return (
      <span className="inline-flex items-center gap-2">
        <InitialsAvatar name={text} size="xs" />
        <span>{text}</span>
      </span>
    );
  }
  const figure = text.trim();
  const match = FIGURE.exec(figure);
  if (match && !ZERO_FIGURE.test(figure) && figure.length <= 40) {
    if (match[1] === '-' && LOSS_HEADER.test(title)) {
      return <span className="font-semibold tabular-nums text-danger">{text}</span>;
    }
    const rule = FIGURE_RULES.find(([pattern]) => pattern.test(title));
    if (rule) return <span className={`font-semibold tabular-nums ${rule[1]}`}>{text}</span>;
  }
  return content;
}
