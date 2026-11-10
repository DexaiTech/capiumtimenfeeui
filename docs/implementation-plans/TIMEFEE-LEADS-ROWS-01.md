# LEADS-ROWS-01 - Leads rows and header read as the Clients list

Status: **Ready for review** (implemented, targeted tests green; browser check pending).
Scope: TimeFee UI only. No API, database or permission change. Follows
`TIMEFEE-CLIENTS-LEADS-PARITY-01.md` (toolbar card and table card).

## 1. Original requirement

The owner compared the live Clients and Leads screens and says they still differ. Decision, 10 Nov
2026: Clients is the reference and does not change; Leads keeps its four cost cards and its
Open / Converted / Archived tabs. What remains is in the table content and header.

## 2. What differed

1. Clients rows start with a round initials avatar (`Initials` in `ClientCells.tsx`, `cc-avatar`,
   colour from the name by `avatarColor`) beside the name. Lead rows had the name alone.
2. The last Clients column is headed "Action" (`.cc-table th.cc-col-action`, right-aligned) over
   right-aligned icons (`RowActions size="sm"`). The shared `DataTable` gave Leads' actions column a
   visually hidden "Actions" heading and 28 px icon buttons.
3. The Leads description was hard-coded and two lines long; Clients reads
   `PAGE_DESCRIPTIONS['clients/list']` (one line). `PAGE_DESCRIPTIONS['clients/leads']` already
   existed (menu tooltip) and is accurate.

Checked and already equal (no change): header and cell font 12 px / weight 500 / line height 15 px,
header colour and body colour (`#5d7186`), name colour (`#313b5e`), header height 37 px, row height
57 px, row separators (`#eaedf1`), checkbox column 45 px, hover tint, card border, radius, shadow.

## 3. Change

- `LeadsPage.tsx`: the Lead cell is `<div class="cc-client">` with `Initials` (initials from
  `initialsOf(name)`, a Lead has none from the API) and the existing name over contact line. The
  actions use `RowActions size="sm"` (as Clients) and `actionsHeader="Action"`. The description is
  `PAGE_DESCRIPTIONS['clients/leads']`.
- `DataTable.tsx`: one new optional prop `actionsHeader`. Absent, nothing changes (hidden "Actions"
  heading, same classes). Present, the heading is that visible text, right-aligned (`text-right`).
  The header padding already equals the actions cell padding, so heading and icons share the edge.

## 4. Files

`src/features/clients/pages/LeadsPage.tsx`, `src/components/ui/DataTable.tsx`,
`src/features/clients/pages/LeadsPage.test.tsx`, `src/components/ui/DataTable.test.tsx`.
Not touched: Clients page and components, `RowActions`, `capium-clients.css`, API, MSW handlers.

## 5. Behaviour kept

Row actions (Open client, Edit, Convert to client, Archive / Unarchive; per permission and status;
no Delete), their order, the `Actions for <name>` group and button names, selection, columns menu,
export, tabs, search, cost cards. The avatar is `aria-hidden`; the row and checkbox names are
unchanged.

## 6. Not changed on purpose (owner to decide)

On Clients the name is upper-case, truncated at 140 px, with a 10 px meta line; on Leads it is
sentence case with a 12 px contact line. Cell padding differs too (Clients `0 8px 0 0`, Leads the
shared `px-3`). Left alone: the Leads second line is long text and the shared padding is used by
every list.

## 7. Risks

Visual only. Verify at 1440 px, laptop width and below 768 px: avatar and name stay on one line,
the "Action" heading sits over the icons, the description is one line.

## 8. Tests

`LeadsPage: the rows, as on Clients` (5): decorative avatar with the name visible and the second
line kept (contact line, or client type); avatar not in the row's accessible name; "Action"
column header (visible text, right-aligned) with right-aligned icon group; actions group and
button names kept; description from the constant. `DataTable: actions heading` (1): hidden
"Actions" by default, visible right-aligned heading with `actionsHeader`. No existing test changed.

## 9. Acceptance

Leads rows carry the Clients avatar; the last column is headed "Action" with right-aligned icons;
the description is one line from `PAGE_DESCRIPTIONS`; every earlier behaviour and test passes.

## Redesign (10 Nov, round 3)

Owner, 10 Nov (twice, with screenshots): Leads still "changes" from Clients; "redesign the page".
Decision: Clients is the reference and does not change; Leads must read as the Clients page.

### What still differed

1. Four cost cards sat between the title and the toolbar and pushed the toolbar about 120 px down.
2. The Lead cell had its own markup (sentence-case name, 12 px contact line); Clients rows use
   `cc-client` > `cc-client-text` > `cc-client-name` (upper-case, truncated) and `cc-client-meta`.
3. Status was the shared `Badge`; Clients uses `cc-pill`. Cell padding was the shared `px-3`;
   `.cc-table` uses `0 8px 0 0` (so the first data column started 7 px later than on Clients).

### Design

- Page order is the Clients order: title and description, ONE toolbar card, table card. Nothing
  sits between the title and the toolbar.
- The four figures (`Open|Converted|Archived leads` count, Acquisition cost, Onboarding cost, Total
  cost: same `useLeadSummary()` data of the active tab, same `formatMoney`) are one slim line in the
  footer of the table card, below the rows and the "Showing n leads / Load more" control. It stays
  a `<dl aria-label="Lead totals">` with the same four labels; it shows (with "-" until the summary
  loads) while loading and when the list is empty. Chosen over a strip under the toolbar because
  the toolbar must stay the first thing under the title and Clients has no extra row there.
- Lead cell: `Initials` + `cc-client-text` with `cc-client-name` (`title` = full name) and
  `cc-client-meta` holding the contact line (or the client type). The row name still starts with the
  checkbox, "Select <name>"; the avatar stays `aria-hidden`.
- Status: `cc-pill cc-pill--info` (Open), `--success` (Converted), plain `cc-pill` (Archived), same
  labels; the client link of a converted lead is `cc-link`. The empty Source dash is `cc-muted`.
- CSS (`.cc-leads-table` block, `capium-clients.css`): cell padding `0 8px 0 0` and 12/15 px type as
  `.cc-table`, checkbox column keeps 14 px left / 0 right; the meta line is cut at 200 px with an
  ellipsis (full text in `title`); new `.cc-leads-summary` rules for the totals line.

### Files

`src/features/clients/pages/LeadsPage.tsx`, `src/styles/capium-clients.css`,
`src/features/clients/pages/LeadsPage.test.tsx`. Not touched: Clients, shared `DataTable`,
`PageToolbar`, `RowActions`, API, MSW handlers. `Card` and `Badge` are no longer used by Leads.

### Tests

Changed: "reads title, cost cards, then the toolbar card" now reads title, toolbar card, table card
(toolbar card is first after the title, nothing before it, table card next). Added
`LeadsPage: the totals line and the cells, as on Clients` (5): same four figures in a slim line
inside the table card after the rows; follows the tab; present when the list is empty; Lead cell
uses `cc-client`, `cc-client-name` (with title) and `cc-client-meta`; Status uses `cc-pill` tones and
`cc-link`. No other test changed.

### Browser check pending

1917, 1440, 1280, 1024, 768 and 375 px: toolbar directly under the title; name and avatar on one
line; totals line wraps cleanly; money columns do not touch the Status pill (8 px gap only, as
Clients); "Action" heading over the icons.
