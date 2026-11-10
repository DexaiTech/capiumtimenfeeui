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
