# APT83 – Action column title doesn't line up with its buttons: implementation plan

Status: **Plan ready for review — no code changed. Waiting for approval.**
Investigated on `origin/main` (`5059d4b`) of `capiumtimenfeeui` on 2026-11-06.

## 1. Original requirement

Ticket APT83 (Low), "Action Grid doesn't align with the buttons": _"As shown in the screenshot below
the title and the buttons don't align."_ Screenshot: Clients list — the **"Action"** column heading
sits well to the left of the four icons (view, edit, archive, delete), which are pushed to the right
edge of the table.

## 2. Requirement interpretation

The "Action" heading must sit over its icons, on every row and at every screen width.

## 3. Existing implementation (evidence)

| Piece            | Where                                                                                                  | Behaviour                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading          | `src/features/clients/components/ClientsTable.tsx:195-198` `<th className="cc-col-action">Action</th>` | Inherits `.cc-table th { text-align: left }` (`src/styles/capium-clients.css:674-677`) → text at the **left** of the column                  |
| Icons            | `ClientsTable.tsx:292-299` `<RowActions size="sm">`                                                    | `RowActions` lays its buttons out with `justify-end` (`src/components/ui/RowActions.tsx:78`) → icons at the **right** of the column          |
| Column width     | `capium-clients.css:669-672` `.cc-col-action { width: 140px }`                                         | The table spreads spare width across columns, so the column is wider than 140 px and the gap between heading and icons grows with the screen |
| Every other grid | `src/components/ui/DataTable.tsx:269-272`, `src/components/ui/Table.tsx:312`                           | Action heading is screen-reader only ("Actions", hidden); icons right-aligned (`DataTable.tsx:343-347` `text-right`) → nothing to misalign   |

Cross-screen check: `grep` over `src` — the Clients list is the only grid with a **visible**
heading over row-action icons (the "Action" columns in `settings/components/integrations/
SyncItemsPanel.tsx:102` and `SyncLogPanel.tsx:80` are text data columns, not icons).

## 4. Root cause

In the Clients table (its own `cc-table` styles, not the shared `DataTable`) the heading is
left-aligned while `RowActions` right-aligns the icons in the same cell, and the column is wider
than the icons, so the two drift apart.

## 5. Affected screens

Clients list (list view). Card/grid view has no heading — unaffected. No other grid has the problem.

## 6. Components and files involved

`src/styles/capium-clients.css` only (one rule). No change to `RowActions` (shared by every grid).

## 7. Proposed solution

Right-align the "Action" heading so it ends where the icons end, the same alignment the shared
grids use for their action column:

```css
.cc-table th.cc-col-action {
  text-align: right;
}
```

Heading and cells already share the same right padding (`.cc-table th, .cc-table td { padding: 0 8px
0 0 }`), so the heading's right edge lines up with the last icon. The heading stays visible (APT76
asked for this column by name). Not proposed: changing `RowActions` (would move icons in every other
grid) or hiding the heading (APT76 wants it shown).

## 8. UI changes

Clients list: the word "Action" moves right, above the icons. Nothing else.

## 9. API changes — none. 10. Database changes — none.

## 11. Edge cases

Fewer icons for a user without archive/delete permission (still right-aligned, heading still at the
right edge); Action column switched off in Show/Hide Columns (no heading, no change); branches on/off;
widths 1280–1920 px and 125 % Windows scaling.

## 12. Regression risks

Very low: one CSS rule scoped to `.cc-table th.cc-col-action`, a class used only by the Clients
table.

## 13. Testing strategy

- Manual in the running app (Playwright): measure the heading's right edge vs the last icon's right
  edge at 1280, 1366, 1536, 1600, 1920 px, with full and reduced permissions; screenshots before/after.
- Cross-screen: Leads, Staff, Invoices grids re-checked (unchanged).
- Existing Clients tests (`ClientsPage.test.tsx`, `test/branches.test.tsx`, `test/central.test.tsx`),
  type check, lint, Prettier, production build, full vitest suite.

## 14. Acceptance criteria

1. On the Clients list the "Action" heading's right edge lines up with the last icon of every row
   (within 2 px) at all tested widths.
2. No other column, grid or screen changes.
