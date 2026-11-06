# APT76 follow-up – Clients toolbar wraps onto two lines: implementation plan

Status: **Plan ready for review — no code changed. Waiting for approval.**
Investigated on `origin/main` (`5059d4b`) of `capiumtimenfeeui` on 2026-11-05, in a local run of
the app (API + UI from `main`, a seeded practice with two branches) and on the live Demo Practice.

## 1. Original requirement

No new ticket. Raised by the developer while verifying APT76 on the live site (2026-11-05): after
switching **Settings → Branches → Use branches** on, the Clients toolbar breaks onto two lines and
the action buttons (Show/Hide Columns … Add Client) jump to the left under the search box.
APT76 asked for "a Branch filter at the top" of the Clients grid; it did not ask for a layout change.

## 2. Requirement interpretation

The Clients toolbar should keep a tidy, predictable layout whatever optional controls it shows
(the Branch select, the Capium Central buttons, the bulk-actions menu): the tabs, search and Branch
select on the left, the actions on the right, on one line when there is room — and when there is
not, the actions should stay **right-aligned**, the way every other list page (built on the shared
`PageToolbar`) behaves. Nothing else on the page changes.

## 3. Existing implementation

| Piece | Where | Behaviour |
|---|---|---|
| Toolbar markup | `src/features/clients/components/ClientsToolbar.tsx:71-203` | `.cc-toolbar` with two `.cc-toolbar-group`s: left = tabs + `.cc-search` + `<BranchFilter>`; right = Columns, Filter set, Filter, Analytics, bulk menu, Drafts, view toggle, [Central clients], [Sync all linked], [Import], Export, [Add Client] (bracketed ones depend on permissions / Capium Central) |
| Toolbar CSS | `src/styles/capium-clients.css:97-115` | `.cc-toolbar { display:flex; flex-wrap:wrap; justify-content:space-between }`; `.cc-toolbar-group { display:flex; flex-wrap:wrap }` — no alignment for a wrapped group |
| Search width | `capium-clients.css:178-182` | `.cc-search { width: 241px }` (fixed) |
| Branch select | `capium-clients.css:507-509`, `BranchFilter.tsx` (APT76) | `.cc-branch-filter { width: 170px }`; rendered only while the practice uses branches |
| Mobile | `capium-clients.css:1460-1472` (`max-width: 767px`) | search and groups go full width |
| Shared toolbar used by the other lists, incl. **Leads** next door | `src/components/ui/PageToolbar.tsx` | from `lg` (1024 px) the two groups share **one row** (`lg:flex-row lg:justify-between`); each group wraps **inside itself**; the actions group is **right-aligned** (`lg:justify-end`) |

Measured in the local app (CSS px; a 1920 px screen at 125 % Windows scaling is ~1536 px):

| Viewport | Branches off | Branches on |
|---|---|---|
| 1280, 1366 | 2 lines, actions left-aligned (already so before APT76) | 2 lines, actions left-aligned |
| 1440 | 1 line | **2 lines, actions left-aligned** (new since APT76) |
| 1600, 1920 | 1 line | 1 line |

Left group 463 px → 643 px with the Branch select; right group 864 px (Capium Central off).

## 4. Root cause

The Clients page uses its own toolbar CSS instead of the shared `PageToolbar`, and that CSS wraps
the **whole right group** onto a new line as soon as the two groups don't fit side by side, with
nothing aligning the wrapped group (`justify-content: space-between` only acts while both groups are
on one line). APT76 added a 170 px control to the left group, so the wrap now starts at ~1550 px
instead of ~1400 px — which covers common laptops at 125 % scaling. The same wrap already happened
before APT76 below ~1400 px, and happens at any width when the Capium Central buttons are shown.

## 5. Affected screens

| Screen | Toolbar | Affected |
|---|---|---|
| Clients list (`/:org/clients`), list and grid view | `cc-toolbar` | **Yes** — the only user of `cc-toolbar` (`grep cc-toolbar src`) |
| Leads (`/:org/clients/leads`) | `PageToolbar` | No change; it is the reference behaviour |
| Every other list (Staff, Invoices, Jobs, Expenses, WIP, …; 57 files use `PageToolbar`) | `PageToolbar` | No change |

## 6. Components and files involved

- `src/styles/capium-clients.css` — the toolbar rules (only file expected to change).
- `src/features/clients/components/ClientsToolbar.tsx` — no change expected (markup stays).
- `docs/ui-standards.md` — one line under "Known inconsistencies" updated once fixed.

## 7. Proposed solution

Make the Clients toolbar behave like the shared `PageToolbar`, in CSS only (no markup, no logic):

1. From 1024 px up, keep both groups on **one row** (`.cc-toolbar { flex-wrap: nowrap }` at
   `min-width: 1024px`), as `PageToolbar` does at `lg`.
2. Let the left group give way first: `.cc-search` becomes `flex: 0 1 241px; min-width: 160px`
   (241 px when there is room, never below 160 px); the Branch select keeps 170 px.
3. The right group wraps **inside itself** and stays **right-aligned**:
   `justify-content: flex-end` on the right `.cc-toolbar-group` (via `:last-child`).
4. Below 1024 px keep today's stacking, but right-align a wrapped actions row; below 768 px the
   existing full-width mobile rules stay as they are.

Expected result: one line wherever the controls fit (≥ ~1500 px with branches on, smaller than
today thanks to the shrinking search); where they can't fit (e.g. 1366 px, or Central buttons on),
the actions wrap onto a second line **on the right**, matching Leads and the other lists.

Alternative considered and **not** proposed: rebuilding the Clients toolbar on `PageToolbar` — it
would remove the duplicate layout for good, but the Clients page is styled by its own design file
(`capium-clients.css`, see docs/ui-standards.md §3), so it is a larger change with a visual risk for
a layout fix. It can be its own consistency ticket.

## 8. UI changes

Toolbar layout on the Clients list only. No text, control, colour or order changes.

## 9. API changes

None.

## 10. Database changes

None.

## 11. Edge cases

- Branches off / on; Capium Central on (two extra buttons); bulk-actions menu visible after
  selecting rows; a user without `client.create` (no Import / Add Client).
- Grid view (same toolbar).
- Long search text (input scrolls; width unaffected).
- Mobile (< 768 px) and tablet (768–1023 px) keep stacking as today.
- Browser zoom 125 % / 150 %.

## 12. Regression risks

- The search box gets narrower on mid-size screens (down to 160 px) — still fits "Quick search"
  and typing; to be checked visually.
- Popovers anchored to toolbar buttons (Columns, Filter set, Filter, Analytics) must still open
  under their buttons after wrapping — checked in the browser.
- CSS-only change in a file used only by the Clients feature: no effect on other pages.

## 13. Testing strategy

- Unit tests can't measure layout (jsdom has none); the existing Clients tests
  (`ClientsPage.test.tsx`, `test/branches.test.tsx`, `test/central.test.tsx`) are run to confirm
  nothing else changed.
- Layout verified in the running app with Playwright at 390, 768, 1024, 1280, 1366, 1440, 1600 and
  1920 px × branches off/on × Capium Central off/on, recording for each: number of lines, whether
  the actions are right-aligned, search width; screenshots before/after at 1366 and 1536.
- Cross-screen: Leads, Staff and Invoices toolbars re-measured to confirm they are unchanged.
- Type check, lint, Prettier (CRLF-safe), production build, full vitest suite.

## 14. Acceptance criteria

1. At ≥ 1600 px, branches on or off, Central off: the Clients toolbar is **one line**.
2. At 1440–1536 px with branches on: one line (search narrower), or — if the controls can't fit —
   the actions wrap **right-aligned**, never left under the search.
3. Wherever the toolbar takes two lines (e.g. 1366 px, Central buttons on), the second line is
   right-aligned, like Leads / Staff / Invoices.
4. Mobile (390 px) and tablet (768 px) look as today.
5. Every toolbar control still works (search, Branch select, popovers, view toggle, Import, Export,
   Add Client); all existing tests pass; no other page changes.
