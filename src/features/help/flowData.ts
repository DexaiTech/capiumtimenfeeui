import type { ModuleId } from '@/constants/navigation';

/** A page of the app a step of the flow points at (module id and page id of `navigation.ts`). */
export interface FlowTarget {
  module: ModuleId;
  page: string;
}

export interface FlowStep {
  id: string;
  title: string;
  /** What the person does here, in one sentence. */
  what: string;
  where: FlowTarget;
  /** What has to be true first, when something does. */
  needs?: string;
}

export interface FlowPhase {
  id: string;
  title: string;
  hint: string;
  steps: ReadonlyArray<FlowStep>;
}

/** The main path of the product, from an empty practice to money in the bank. */
export const FLOW_PHASES: ReadonlyArray<FlowPhase> = [
  {
    id: 'setup',
    title: 'Set up once',
    hint: 'Do these first, in this order. The Getting started card on the dashboard tracks them.',
    steps: [
      {
        id: 'practice',
        title: 'Describe the practice',
        what: 'Name, VAT registration, how rates are chosen, and whether time and invoices need approval.',
        where: { module: 'settings', page: 'practice' },
      },
      {
        id: 'roles',
        title: 'Check roles and numbering',
        what: 'Decide what each role may do, and how invoices and credit notes are numbered.',
        where: { module: 'settings', page: 'roles' },
      },
      {
        id: 'grades',
        title: 'Grades and rates',
        what: 'Give each grade a cost and a charge-out rate. Time is valued at the rate in force the moment it is saved.',
        where: { module: 'team', page: 'grades' },
        needs: 'Do this before anyone records time, or that time is valued at £0.',
      },
      {
        id: 'staff',
        title: 'Add staff',
        what: 'Grade, approver, working hours, and a sign-in for people who record or approve their own time.',
        where: { module: 'team', page: 'staff' },
        needs: 'Someone without a sign-in cannot submit a timesheet.',
      },
      {
        id: 'services',
        title: 'Services',
        what: 'The kinds of work you sell, with default fees, activity types and default tasks.',
        where: { module: 'team', page: 'services' },
      },
    ],
  },
  {
    id: 'work',
    title: 'Do the work',
    hint: 'What happens every day.',
    steps: [
      {
        id: 'clients',
        title: 'Clients',
        what: 'Add a client with its contacts and the services you provide it (engagements).',
        where: { module: 'clients', page: 'list' },
      },
      {
        id: 'jobs',
        title: 'Jobs and tasks',
        what: 'A job is a piece of work for a client. Create it by hand, import it, or let an engagement create it every period.',
        where: { module: 'jobs', page: 'list' },
        needs:
          'For automatic jobs, the engagement needs a start date and "create jobs automatically".',
      },
      {
        id: 'time',
        title: 'Record time and expenses',
        what: 'Log time on the weekly timesheet or with the timer. Claim expenses with receipts, or record a disbursement for a client.',
        where: { module: 'time', page: 'my-timesheet' },
      },
      {
        id: 'approve',
        title: 'Submit and approve',
        what: 'Staff submit the week. A manager approves or returns it. Approved time is locked.',
        where: { module: 'time', page: 'approvals' },
      },
    ],
  },
  {
    id: 'bill',
    title: 'Bill and get paid',
    hint: 'Usually weekly or monthly.',
    steps: [
      {
        id: 'wip',
        title: 'Unbilled work (WIP)',
        what: 'Approved time, disbursements and approved expenses wait here until they are billed or written off.',
        where: { module: 'wip', page: 'summary' },
      },
      {
        id: 'invoice',
        title: 'Create the invoice',
        what: 'Choose the client and the work to bill, review the lines, set the dates. Larger invoices may need approval.',
        where: { module: 'billing', page: 'prepare' },
      },
      {
        id: 'issue',
        title: 'Issue and send',
        what: 'Issuing numbers the invoice and locks it. Email it to the client in the same step.',
        where: { module: 'billing', page: 'invoices' },
      },
      {
        id: 'payment',
        title: 'Record the payment',
        what: 'Match money received to invoices. Anything left over stays on account.',
        where: { module: 'billing', page: 'payments' },
      },
      {
        id: 'reports',
        title: 'Reports',
        what: 'Utilisation, profitability, work in progress, money owed.',
        where: { module: 'reports', page: 'utilisation' },
      },
    ],
  },
];

export interface SideRoute {
  title: string;
  what: string;
  where: FlowTarget;
}

/** Other ways into, and out of, the main path. */
export const SIDE_ROUTES: ReadonlyArray<SideRoute> = [
  {
    title: 'Estimates',
    what: 'Quote first; an accepted estimate becomes a draft invoice.',
    where: { module: 'billing', page: 'estimates' },
  },
  {
    title: 'Recurring invoices',
    what: 'A schedule drafts the same invoice every period. Review and issue each draft.',
    where: { module: 'billing', page: 'recurring' },
  },
  {
    title: 'Credit notes and void',
    what: 'Correct an issued invoice. Voided or credited work can return to unbilled work.',
    where: { module: 'billing', page: 'credit-notes' },
  },
  {
    title: 'Write off and adjust',
    what: 'Take work out of WIP without billing it, with a reason.',
    where: { module: 'wip', page: 'adjustments' },
  },
  {
    title: 'Expenses and disbursements',
    what: 'Claims go through approval; billable ones recharge the client through WIP.',
    where: { module: 'expenses', page: 'mine' },
  },
];

export interface Lifecycle {
  name: string;
  steps: ReadonlyArray<string>;
  note: string;
}

/** The states each record moves through, and who moves it. */
export const LIFECYCLES: ReadonlyArray<Lifecycle> = [
  {
    name: 'Job',
    steps: ['Not started', 'In progress', 'On hold', 'Completed', 'Closed'],
    note: 'A completed or closed job takes no more time; reopen it to log more.',
  },
  {
    name: 'Timesheet',
    steps: ['Open', 'Submitted', 'Approved'],
    note: 'A manager can return a submitted week; the owner can recall it. An approved week is locked until a manager reopens it.',
  },
  {
    name: 'Expense claim',
    steps: ['Draft', 'Submitted', 'Approved'],
    note: 'Returned claims go back to draft with a reason. Lines over the receipt limit need a receipt to submit.',
  },
  {
    name: 'Invoice',
    steps: ['Draft', 'Awaiting approval', 'Approved', 'Issued', 'Paid'],
    note: 'Approval only applies when the practice asks for it. An issued invoice is corrected with a credit note, or voided if nothing was paid.',
  },
  {
    name: 'Estimate',
    steps: ['Draft', 'Sent', 'Accepted', 'Converted to invoice'],
    note: 'A declined or expired estimate stays as a record.',
  },
  {
    name: 'Ticket (Application Testing)',
    steps: ['Open', 'In progress', 'Ready for BA review', 'Closed'],
    note: 'Any status can follow any other; every change is kept in the ticket timeline.',
  },
];

export interface RoleRow {
  role: string;
  can: string;
}

export const ROLES: ReadonlyArray<RoleRow> = [
  { role: 'Owner', can: 'Everything, including deleting the practice.' },
  {
    role: 'Admin',
    can: 'Everything except deleting the practice: staff, roles, settings, billing.',
  },
  { role: 'Partner', can: 'Clients, billing and write-offs; not import/export or integrations.' },
  { role: 'Manager', can: 'Runs jobs, approves time, prepares invoices.' },
  { role: 'Billing', can: 'Invoices, credit notes and payments.' },
  { role: 'Staff', can: 'Records their own time and disbursements.' },
  { role: 'Viewer', can: 'Reads clients, jobs, time and billing.' },
];

export interface Warning {
  title: string;
  why: string;
}

/** What goes wrong silently when the order of the main path is not followed. */
export const BEFORE_YOU_START: ReadonlyArray<Warning> = [
  {
    title: 'Rates before time',
    why: 'Time is valued at the rate in force when it is saved, and a later rate never rewrites it. Without rates it is worth £0. "Change Rates on Past Time" fixes unbilled time.',
  },
  {
    title: 'A sign-in for people who submit or approve',
    why: 'A staff member without a sign-in is a placeholder: a manager records their time, and it never reaches approval on its own.',
  },
  {
    title: 'Approval switch and WIP',
    why: 'When timesheet approval is on, time that is not approved yet is not unbilled work and cannot be invoiced.',
  },
  {
    title: 'Engagements and automatic jobs',
    why: 'The engagement needs a start date and "create jobs automatically". Jobs appear on the first day of the period window and are never created for the past.',
  },
  {
    title: 'Locked weeks and periods',
    why: 'Approved timesheets and periods before the lock date refuse changes. Ask a manager to reopen the week.',
  },
];

export interface GlossaryEntry {
  term: string;
  meaning: string;
}

export const GLOSSARY: ReadonlyArray<GlossaryEntry> = [
  {
    term: 'WIP (work in progress)',
    meaning: 'Work done but not yet billed: approved time, disbursements and approved expenses.',
  },
  {
    term: 'Write-off',
    meaning: 'Taking work out of WIP without billing it, with a reason. Write-on puts value back.',
  },
  {
    term: 'Grade',
    meaning: 'A level of staff (for example Senior) with default cost and charge-out rates.',
  },
  {
    term: 'Charge-out rate',
    meaning:
      'What the practice bills for an hour. The cost rate is what an hour costs the practice.',
  },
  {
    term: 'Engagement',
    meaning:
      'A service you provide a client on a schedule, with a fee and, optionally, jobs created automatically.',
  },
  {
    term: 'Job',
    meaning: 'A piece of work for a client, with a budget, a manager, assignees and tasks.',
  },
  { term: 'Disbursement', meaning: 'A cost paid on a client’s behalf and recharged to them.' },
  {
    term: 'Timesheet',
    meaning: 'One person’s week of time. It is submitted, then approved or returned.',
  },
  { term: 'Utilisation', meaning: 'The share of working time that was chargeable.' },
  { term: 'Recoverability', meaning: 'How much of the value of work was actually billed.' },
  {
    term: 'Ageing',
    meaning: 'How old unbilled work or unpaid invoices are, in bands (for example over 90 days).',
  },
  { term: 'On account', meaning: 'Money received that is not yet matched to an invoice.' },
  {
    term: 'Credit note',
    meaning: 'A document that reduces an issued invoice. It is numbered and cannot be edited.',
  },
  { term: 'Re-rate', meaning: 'Re-pricing unbilled time with the current rates.' },
  {
    term: 'Period lock',
    meaning: 'A date before which time, expenses and WIP can no longer be changed.',
  },
];

export interface Shortcut {
  keys: string;
  does: string;
}

export const SHORTCUTS: ReadonlyArray<Shortcut> = [
  { keys: '/', does: 'Search for a page' },
  { keys: 'Ctrl or Cmd + K', does: 'Search for a page, even from a field' },
  { keys: 'Ctrl or Cmd + Enter', does: 'Save the form you are in' },
  { keys: 'Esc', does: 'Close the form, menu or search (asks first if you typed something)' },
];
