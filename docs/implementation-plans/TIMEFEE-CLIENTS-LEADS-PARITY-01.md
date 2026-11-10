# CLIENTS-LEADS-PARITY-01 - Leads reads as the Clients screen

Status: **Ready for review** (implemented, targeted tests green; browser check pending).
Scope: TimeFee UI only. No API, database or permission change. Base: `main` `91ed885`.

## 1. Original requirement

Raj, 9 Nov 2026, about Leads: "look and feel is changing... keep remain the same", "here you are
giving that selection, here not giving the selection". Owner decisions, 10 Nov 2026 (final):

1. Leads copies Clients. The Clients screen is the reference and does not change; only Leads does.
2. Leads keeps its Open / Converted / Archived tabs and its four cost cards; the tabs go inside the
   same toolbar card as the search.

## 2. What differed (measured on main, 1440 px)

- Clients: one bordered toolbar card. Row 1: `Clients | Leads` switch, then "Quick search" (`cc-search`).
  Row 2: Show/Hide Columns first ... primary Add Client last (`cc-btn`).
- Leads: the switch floated above everything; then the cost cards; then a separate shared
  `PageToolbar` card with `CountTabs`, `SearchField` and, on the right, Show/Hide Columns,
  Export selected, Add lead (shared `Button`/`ColumnVisibilityMenu`, a different look).
- Table: shared `DataTable` (`list-card` violet glow, 12 px radius, 40 px checkbox column at 12 px,
  16 px checkbox, `row-glow` hover bar) against the Clients `cc-table-card` (grey border, soft
  shadow, 10 px radius, 45 px checkbox column at 14 px, 14 px checkbox, plain tinted hover).
  Header 37 px and row 57 px already matched.

## 3. Target

Page: title, four cost cards, then ONE toolbar card (`cc-toolbar`, role toolbar "Leads toolbar"):
row 1 the `ClientsLeadsSwitch` (current "leads", both counts), the Open/Converted/Archived tabs in
the `cc-tabswitch` look, the search (`cc-search`; label "Search leads", placeholder unchanged,
max 100 as the API requires); row 2 Show/Hide Columns, Export selected (`cc-btn--outline`), Add lead
(`cc-btn--primary`, `client.create`). Table card, checkbox column and hover as Clients.
Gaps between title, cards and toolbar are the Clients 10 px (`gap-2.5`, was `gap-4`).

## 4. Files

- `src/features/clients/components/LeadsToolbar.tsx` (new): the toolbar card, its columns menu
  (same markup and classes as the Clients `ColumnsMenu`, over the lead columns, popover name
  "Visible columns" kept) and the tabs (roving tabindex, arrow keys, Home/End as `CountTabs`).
- `src/features/clients/pages/LeadsPage.tsx`: uses `LeadsToolbar`; no `PageToolbar`, `CountTabs`,
  `SearchField` or `ColumnVisibilityMenu`; the switch is no longer rendered above the cards;
  `LeadList` takes `clientCount`; on a load error the switch still shows above the error card.
- `src/styles/capium-clients.css`: `.cc-toolbar-group--row` (a group on its own row) and a small
  `.cc-leads-table` block (card border/radius/shadow, checkbox column, checkbox size, hover).
- `src/features/clients/pages/LeadsPage.test.tsx`: new describe block (see 6).
- Not touched: Clients page and components, shared `DataTable`, `PageToolbar`, `CountTabs`,
  `SearchField`, `ColumnVisibilityMenu`, API, MSW handlers.

## 5. Behaviour kept

Tabs with counts and URL `?tab=`; debounced search; selection and select-all cleared on a tab or
search change; Show/Hide Columns persisted by `usePersistentColumns('leads')` with Lead and Status
locked; Export selected (visible columns, selected rows, `leads-selected.csv`); Add lead gated by
`client.create`; all row actions; loading, empty and error states; cost cards.

## 6. Deliberate differences from before

- No clear (x) button inside the search, as on Clients (the browser's native one, Escape and the
  empty state's "Clear search" remain).
- Show/Hide Columns gains "Show all columns" like the Clients menu.
- Open PR #28 adds `compactLabel` to the Export selected `Button`; that button no longer exists
  here (it is a `cc-btn`), so that one line disappears when the branches merge.

## 7. Risks

- Visual only; verify in a browser at 1440 px, laptop width and below 768 px (row 2 wraps).
- The table overrides are scoped to `.cc-leads-table`; first data column text starts 7 px later
  than on Clients (shared `px-3` cell padding, left alone on purpose).

## 8. Tests

New `LeadsPage: the toolbar card, as on Clients` (7): switch inside the toolbar card with its
counts; title, cards, toolbar order and switch, tabs, search, Show/Hide, Export selected, Add lead
in DOM order; Clients classes; search label, placeholder, max length and Escape; arrow keys and
Home/End on the tabs; the switch stays when the list fails; Show all columns. The existing 34
tests pass unchanged.

## 9. Acceptance

Leads shows one toolbar card with the switch first, tabs, search, then Show/Hide Columns, Export
selected and Add lead, in the Clients look; every Leads function above still works.
