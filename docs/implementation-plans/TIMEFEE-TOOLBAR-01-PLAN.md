# TIMEFEE-TOOLBAR-01 – One-row list toolbars on every laptop width (shared `PageToolbar`)

Status: **Ready for review** – plan approved 9 Nov 2026 (answers in §16); §7.1–§7.5
implemented on `feature/timefee-toolbar-01` from `main` `61ebf18` (notes in §18). Browser layout
check (§13) run: 25 / 25 (§18.1).
Base: `capiumtimenfeeui` `origin/main` `a35c10a` (read-only worktree `capiumtimenfeeui-readonly`).
Evidence: the measurements in [TIMEFEE-RESPONSIVE-ISSUES.md](TIMEFEE-RESPONSIVE-ISSUES.md) §3 (Chromium,
local stack) and the 1440 px screenshots (`Invoices_1440_100.png`, `invoices_1440_90.png`,
`Jobs_1440_100.png`, `Expenses_1440_100.png`). No server, browser, build or test was run for this plan.
Related plans: [APT76-followup-toolbar.md](APT76-followup-toolbar.md) (Clients `cc-toolbar`, pending),
[TIMEFEE-LEADS-01-GRID-PARITY.md](TIMEFEE-LEADS-01-GRID-PARITY.md) (refers to this ticket as "TOOLBAR-01 (R-13)"),
[TIMEFEE-CLIENT-LEADS-CONSISTENCY-PLAN.md](TIMEFEE-CLIENT-LEADS-CONSISTENCY-PLAN.md).

## Pre-coding checkpoint

| Item          | Done                                                                                                                                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs reviewed | `CLAUDE.md`; `docs/ui-standards.md` §1 (catalogue), §2.1 (list page and toolbar), §2.8, §2.9, §2.13, §2.16, §3; the three plans above                                                                                                                                                               |
| Graphify      | `C:\Users\pc\capium-graph\graphify-out\graph.json` (built 2026-11-05) has a `PageToolbar.tsx` node but only 9 references; it is **incomplete** for this question. The user list below comes from `grep -rl "<PageToolbar" src` (57 files) and was read in code                                      |
| Instructions  | Raj, 9 Nov 2026 (below). Earlier agreed direction: APT76 follow-up rule for the search (`flex: 0 1 241px; min-width: 160px`, actions right-aligned when wrapped) – kept identical here                                                                                                              |
| Code read     | `PageToolbar`, `CountTabs`, `SearchField`, `Button`/`buttonStyles`, `Tooltip`, `ColumnVisibilityMenu`, the 7 `FilterPopover` copies, the 4 `ExportMenu` copies, `DataTable` toolbar slot, `AppShell`, `Sidebar`, `OverflowNav`, `theme.css`, Tailwind 4.3.3 variant code, all 57 toolbar call sites |

## 1. Original requirement

Raj (9 Nov 2026, recording 11:09, 0:22–0:58): the Invoices toolbar wraps onto two lines – "why
this double line?" – while Jobs and Expenses fit one; "check it is based on screen… responsive
based". Requirements passed on:

- no unnecessary wrapping on laptops;
- the search shrinks;
- buttons stay accessible;
- every status tab stays reachable (visible scrolling or a More menu);
- a predictable tablet layout;
- works at 1920 / 1600 / 1440 / 1366 / 1280 / 1024 / 768 px and with browser zoom;
- never hide important functionality.

## 2. Interpretation

- The fix belongs in the **shared** toolbar (`PageToolbar` + `CountTabs`), so every list behaves the
  same ("every grid same behaviour"); page code changes only where a page adds a control that
  must opt in (Export buttons) or where it puts a non-toolbar block inside the toolbar (Invoices
  bulk selection).
- "One row" is achieved by letting the **tabs give way** (scroll inside their box, with a visible
  affordance) and the search shrink to 160 px, instead of the whole toolbar wrapping. Secondary
  actions (Show/Hide Columns, Export) become icon buttons when the toolbar is narrow; the primary
  button and Filter (which shows the active-filter count) keep their labels.
- **Laptop vs tablet is decided by the toolbar's own width, not the viewport.** Verified in code:
  from `lg` (1024 px) the module sidebar (`Sidebar.tsx:89`, `w-60` = 240 px) sits beside the content
  and `main` has `lg:px-6` (`AppShell.tsx:60`), so at a 1024 px window the content is
  1024 − 240 − 48 = **736 px – exactly the width of a 768 px tablet** (768 − 2 × 16, `sm:px-4`).
  Confirmed from the screenshots: at 1440 the toolbar spans x = 264…1416 (1,152 px = 1440 − 288);
  at 1600 CSS px (`invoices_1440_90.png`) x = 273…1567 (1,294 ≈ 1600 − 240 − 64, `2xl:px-8`).
- **Conflict in the brief, needs a decision (Q3):** "one row from `lg`" vs "≤ 2 rows on tablets,
  1024 = tablet" (responsive doc §3 header). This plan recommends: one row whenever the toolbar is at
  least 48 rem wide (every laptop width 1280–1920 at 90/100/110 %, 1024 at 90 %, 1024 with the
  sidebar collapsed); at 1024 @ 100 % with the sidebar open, and on 768 tablets, the toolbar is
  718 px and gets the predictable **2-row** layout (tabs; then search + actions). Reason: at 718 px
  a one-row Invoices toolbar would show ~3 of 10 tabs, a 2-row one shows ~7. The alternative (one
  row down to 42 rem) is a one-token change if Raj prefers it.

## 3. Existing implementation (file:line, `a35c10a`)

| Piece                           | Where                                                                                                                                                    | Behaviour                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageToolbar`                   | `src/components/ui/PageToolbar.tsx:29-45`                                                                                                                | Root `flex flex-col gap-2.5 … p-2 lg:flex-row lg:items-center lg:justify-between` (l.32). Left group `flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center` = `start` + `search` (l.36-39). Right group `flex flex-wrap items-center gap-2.5 lg:justify-end` = `actions` + `primaryAction` (l.40-43). Switches on the **viewport** `lg`; each group wraps **independently** |
| `CountTabs`                     | `src/components/ui/CountTabs.tsx:48-91`                                                                                                                  | One `div role="tablist"` with `flex max-w-full min-w-0 shrink-0 … overflow-x-auto` (l.55). No overflow affordance, no scroll-into-view of the selected tab. Arrow/Home/End keys move and `focus()` the next tab (l.35-46). Tab buttons `h-10 … md:h-[27px] whitespace-nowrap` (l.71)                                                                                                          |
| `SearchField`                   | `src/components/ui/SearchField.tsx:28`                                                                                                                   | Root `relative w-full sm:w-[241px]`; input `aria-label={label}` (l.36); clear button "Clear search" (l.56)                                                                                                                                                                                                                                                                                    |
| `Button`                        | `src/components/ui/Button.tsx:19-46`, `buttonStyles.ts:13-40`                                                                                            | No icon-only mode for a labelled button. `leftIcon` then `children` then `rightIcon` (l.42-44); `...rest` passes `aria-label`/`title` (l.40). Sizes `icon` / `icon-sm` exist (`buttonStyles.ts:38-39`) but are for pure icon buttons. Base has `shrink-0 whitespace-nowrap` (l.14)                                                                                                            |
| `Tooltip`                       | `src/components/ui/Tooltip.tsx:51-112`                                                                                                                   | Wraps one focusable child in a `span` (l.84-91), shows on hover/focus via a portal (l.93-108), sets `aria-describedby` while open (l.92), `disabled` prop (l.20). Used in 6 files; row icon buttons use the native `title` from `RowActions` instead (ui-standards §1)                                                                                                                        |
| `ColumnVisibilityMenu`          | `src/components/ui/ColumnVisibilityMenu.tsx:41-51`                                                                                                       | `Button variant="outline" size="sm" leftIcon={<Columns3/>}` with label "Show/Hide Columns" (l.27); popover `align="end"` anchored to the button (l.52-58)                                                                                                                                                                                                                                     |
| `FilterPopover` (7 copies)      | `features/{billing,expenses,jobs,reports,team,time,wip}/components/FilterPopover.tsx` (billing l.22-38)                                                  | Outline "Filter" button with `Funnel` icon; the active count badge is a **child** of the button (l.31-37)                                                                                                                                                                                                                                                                                     |
| `ExportMenu` (4 copies)         | `features/{audit,reports,time/analysis,wip}/components/ExportMenu.tsx` (audit l.57-69)                                                                   | `brand-outline` "Export" button with `Download` icon; 3 of them sit in a `PageToolbar` (reports, time analysis, historic WIP)                                                                                                                                                                                                                                                                 |
| `DataTable` toolbar slot        | `src/components/ui/DataTable.tsx:63`, l.192-193                                                                                                          | Rendered as the first child of `flex min-w-0 flex-1 flex-col gap-2.5` → the toolbar is stretched to the full width                                                                                                                                                                                                                                                                            |
| Breakpoints / container queries | `src/styles/theme.css:219-222` (`sm` 40, `md` 48, `lg` 64, `xl` 80 rem; `2xl` default 96 rem), l.226 `--container-content` (unused)                      | **No `@container` usage anywhere in `src`** (grep). Tailwind **4.3.3** (`node_modules/tailwindcss/package.json`) builds in `@container/<name>`, `@<size>`, `@min-*`, `@max-*` variants resolved from `--container-*` (verified in `dist/lib.js`); `--container-*` is not reset in `theme.css`, so `3xl` = 48 rem and `6xl` = 72 rem exist                                                     |
| Shell widths                    | `AppShell.tsx:18` (`DESKTOP_QUERY` 64 rem: sidebar from `lg`), l.60 (`px-3 sm:px-4 lg:px-6 2xl:px-8`); `Sidebar.tsx:89` (`w-60`, collapsed `w-[4.5rem]`) | Toolbar outer width = window − 288 (lg…<2xl) / − 304 (≥ 2xl); − 32 below `lg`; inner (container) width = outer − 18 (border + `p-2`)                                                                                                                                                                                                                                                          |
| "More" precedent                | `src/components/layout/OverflowNav.tsx:52-90` (`useFitCount`), l.96-101                                                                                  | Top bar / sub-nav fold what does not fit into a "More" `Dropdown`, keep the active item visible; in a test DOM "every item counts as fitting" (l.62-65)                                                                                                                                                                                                                                       |

Invoices (`features/billing/pages/InvoicesPage.tsx:430-562`): 10 tabs with counts (`TABS` l.70-76,
`INVOICE_TAB_ORDER` `billing/constants.ts:40-50`), search "Search number or client", actions =
[bulk "Selected invoices" group l.449-505 when rows are chosen] + Filter + Show/Hide Columns +
Export CSV (l.536-544), primary Create invoice (l.547-558).
Jobs (`features/jobs/pages/JobsPage.tsx:254-321`): 7 tabs, search, My jobs (no icon, `aria-pressed`,
l.273-280), Filter, Show/Hide Columns, primary New job; its bulk bar is **outside** the toolbar
(l.322-331). My Expenses (`expenses/pages/MyExpensesPage.tsx:217`): 5 tabs, search, Filter,
Show/Hide Columns, New claim.

## 4. Root cause

| Group            | Cause (measured + code)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invoices**     | Natural one-row width ≈ 1,709 px (10 tabs ≈ 950, search 241, Filter 72 + Show/Hide 155 + Export CSV 105 + Create invoice 119, gaps, padding) – wider than the content at **every** laptop width (1,616 at 1920). `PageToolbar` has no way to give way except wrapping: both groups wrap independently (`PageToolbar.tsx:36,40`) → search under the tabs, Export/Create under Filter = "double line". Inside the first line `CountTabs` scrolls silently (`CountTabs.tsx:55`): at 1440 Void and Overdue are hidden, at 1600 CSS "Ove" is cut (`invoices_1440_90.png`), no affordance, and a deep link `?tab=overdue` leaves the selected tab out of view |
| **Jobs**         | ≈ 1,216 px → fits only from a ~1,500 px window; at 1440/1366/1280 the same independent wrapping. At exactly 1024 the viewport `lg` switch puts both groups side by side in a 718 px toolbar → 4–5 rows (the narrowest space gets the row layout)                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Expenses**     | ≈ 982 px → fits down to ~1,270–1,300 px windows, wraps below (measured 2 rows at 1280 @ 100 %)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **All 57 users** | (1) a viewport breakpoint where the available width depends on the sidebar (736 px at 1024 = 768 tablet); (2) groups wrap instead of shrinking; (3) the search never shrinks (`sm:w-[241px]`); (4) labels never collapse; (5) tab overflow is invisible                                                                                                                                                                                                                                                                                                                                                                                                 |

## 5. Affected screens (all 57 `PageToolbar` users)

Natural one-row width is an **estimate** (tab ≈ 24 px + 5.35 px/char, +28 px with a count pill;
button widths from the screenshots); the measurement run in §13 replaces it. "Wraps below" = smallest
window (sidebar open, 100 %) that fits one row **today**.

Ranked, most likely to wrap first:

| #   | Screen (file:line)                                                | Tabs                  | Search                     | Actions (count)                                  | Primary           | Est. width | Wraps below         |
| --- | ----------------------------------------------------------------- | --------------------- | -------------------------- | ------------------------------------------------ | ----------------- | ---------- | ------------------- |
| 1   | Invoices `billing/pages/InvoicesPage.tsx:430`                     | 10 + counts           | yes                        | Filter, Columns, Export CSV (+ bulk group) (3)   | Create invoice    | ~1,709     | **~2,014** (always) |
| 2   | Expense Claims `expenses/pages/ExpenseClaimsPage.tsx:295`         | 5 + counts            | yes                        | Filter, Columns, Approve selected (N) (3)        | New claim         | ~1,304     | ~1,609              |
| 3   | Jobs `jobs/pages/JobsPage.tsx:254`                                | 7                     | yes                        | My jobs, Filter, Columns (3)                     | New job           | ~1,216     | ~1,505              |
| 4   | WIP details `wip/pages/WipDetailsPage.tsx:244`                    | 6                     | yes                        | Segmented "Show", Filter, Columns (3)            | –                 | ~1,146     | ~1,435              |
| 5   | Payments `billing/pages/PaymentsPage.tsx:148`                     | 6 (count on selected) | yes                        | Filter, Columns (2)                              | Record payment    | ~1,123     | ~1,412              |
| 6   | Staff `team/pages/StaffMembersPage.tsx:429`                       | 4 (count on selected) | yes                        | Columns, Filter, Export (3)                      | Add staff member  | ~1,033     | ~1,322              |
| 7   | Estimates `billing/pages/EstimatesPage.tsx:137`                   | 6 + counts            | yes                        | Filter (1)                                       | New estimate      | ~1,002     | ~1,291              |
| 8   | My Expenses `expenses/pages/MyExpensesPage.tsx:217`               | 5                     | yes                        | Filter, Columns (2)                              | New claim         | ~982       | ~1,271              |
| 9   | Leads **after LEADS-01** `clients/pages/LeadsPage.tsx:323`        | 3 + counts            | yes                        | Columns, Export selected (2)                     | Add lead          | ~972       | ~1,261              |
| 10  | Activity types `team/pages/ActivityTypesPage.tsx:276`             | 3 + counts            | yes                        | Columns (1)                                      | Add activity type | ~927       | ~1,216              |
| 11  | Tasks `jobs/pages/TasksPage.tsx:163`                              | 5                     | yes                        | Filter, Columns (2)                              | –                 | ~915       | ~1,204              |
| 12  | Time entries `time/pages/TimeEntriesPage.tsx:568`                 | 3                     | DateRangeField in `search` | Columns, Filter, Export (3)                      | Add entry         | ~914       | ~1,203              |
| 13  | Rate rules `team/components/rates/RateRulesView.tsx:325`          | 4                     | yes                        | Columns, Filter (2)                              | Add rate          | ~908       | ~1,197              |
| 14  | VAT codes `settings/pages/VatCodesPage.tsx:289`                   | 3 + counts            | yes                        | Columns (1)                                      | Add VAT code      | ~874       | ~1,163              |
| 15  | Invoice templates `settings/pages/InvoiceTemplatesPage.tsx:307`   | 3 + counts            | yes                        | Columns (1)                                      | Add template      | ~874       | ~1,163              |
| 16  | Services `team/pages/ServicesPage.tsx:365`                        | 3 + counts            | yes                        | Columns (1)                                      | Add service       | ~864       | ~1,153              |
| 17  | Budget tracking `jobs/pages/BudgetTrackingPage.tsx:311`           | 4                     | yes                        | Filter, Columns (2)                              | –                 | ~833       | ~1,122              |
| 18  | Client 360 Payments `clients/workspace/tabs/PaymentsTab.tsx:155`  | –                     | yes                        | Status, Method selects, date range (3)           | –                 | ~829       | ~1,117              |
| 19  | WIP summary `wip/components/SummaryView.tsx:158`                  | 5                     | yes                        | Filter, Columns (2)                              | –                 | ~824       | ~1,113              |
| 20  | Recurring `billing/pages/RecurringInvoicesPage.tsx:116`           | 4 + counts            | yes                        | Filter (1)                                       | New schedule      | ~810       | ~1,099              |
| 21  | Historic WIP `wip/pages/HistoricWipPage.tsx:176`                  | 3                     | –                          | As-at date + Last month end, Filter, Columns (3) | –                 | ~795       | ~1,084              |
| 22  | Team timesheets `time/pages/TeamTimesheetsPage.tsx:314`           | 2 + counts            | yes                        | Filter, Send reminders, Export (3)               | –                 | ~790       | ~1,079              |
| 23  | Grades `team/pages/GradesPage.tsx:247`                            | 3 (count on selected) | yes                        | Columns (1)                                      | Add grade         | ~787       | ~1,076              |
| 24  | Client 360 Invoices `clients/workspace/tabs/InvoicesView.tsx:227` | –                     | yes                        | Status select, date range (2)                    | New invoice       | ~774       | ~1,063              |
| 25  | Client 360 Time `clients/workspace/tabs/TimeTab.tsx:224`          | title                 | –                          | date range, Billable, Status (3)                 | Add time          | ~763       | ~1,052              |
| 26  | Client 360 Expenses `clients/workspace/tabs/ExpensesTab.tsx:200`  | title                 | –                          | date range, Billable, Status (3)                 | Add expense       | ~753       | ~1,042              |
| 27  | Time analysis `time/pages/TimeAnalysisPage.tsx:239`               | Group-by select       | Period + dates             | Filter, ExportMenu (2)                           | –                 | ~745       | ~1,033              |
| 28  | Credit notes `billing/pages/CreditNotesPage.tsx:121`              | title                 | yes                        | Filter, Columns (2)                              | Raise credit note | ~738       | ~1,026              |

Fit at every laptop width today (≤ ~730 px; still re-laid out by the shared change):
WIP adjustments `wip/components/AdjustmentsView.tsx:278` (5 + counts; Filter, Columns), Leads today
`LeadsPage.tsx:323` (3 + counts; Add lead), Disbursements `expenses/pages/DisbursementsPage.tsx:300`
(5; Filter; Record disbursement), Expense approvals `expenses/pages/ExpenseApprovalsPage.tsx:166`
(text; search; Select all, Filter; Approve), Expense types `expenses/pages/ExpenseTypesPage.tsx:282`
(3; search; Add expense type), Rate history `team/pages/RateHistoryPage.tsx:213` (3; Columns, Filter,
Export), Overtime rates `team/components/overtime/OvertimeRatesView.tsx:206` (4; Filter; Add overtime
rate), WIP transfers `wip/pages/WipTransfersPage.tsx:167` (3; Filter, Columns), WIP ledger
`wip/components/LedgerView.tsx:175` (4; Filter), Receipts `expenses/pages/ReceiptsPage.tsx:369` (2;
search; filter panel), Branches `settings/pages/BranchesPage.tsx:211` (3 + counts; search; Add
branch), Segments `settings/pages/SegmentsPage.tsx:228` (3 + counts; search; Add segment), Roles
`settings/pages/RolesSettingsPage.tsx:168` (1 tab), Email templates
`notifications/components/templates/EmailTemplatesView.tsx:146` (2 + counts), Reports
`reports/components/ReportScreen.tsx:204` (group-by; period controls; Filter, ExportMenu), My
timesheet `time/pages/MyTimesheetPage.tsx:177` (period navigator; view switch), Timesheet approvals
`time/pages/TimesheetApprovalsPage.tsx:223` (Select all; Correct approved time; Approve), Debtors
`billing/components/debtors/DebtorsView.tsx:215` (as-at date; Filter, Columns), Reminder log
`billing/components/debtors/ReminderLogView.tsx:179` (Filter), Statements
`billing/components/statements/StatementsView.tsx:225` (search; Filter, Columns), Billing summary
`billing/components/prepare/BillingSummary.tsx:389` (search; Work ready to bill only, Columns), Work
step `billing/components/prepare/WorkStep.tsx:110` (job select; Columns), Invoice lines
`billing/components/invoice/InvoiceLinesCard.tsx:99` (title only), Write-offs
`wip/components/WriteOffsView.tsx:163` (Filter), Client 360 Jobs `clients/workspace/tabs/JobsTab.tsx:205`
(search; Status, New job link), Credit notes `clients/workspace/tabs/CreditNotesView.tsx:125` (search;
date range), WIP `clients/workspace/tabs/WipTab.tsx:248` (title; job select), Rates
`clients/workspace/settings/RatesCard.tsx:137`, Services `.../ServicesCard.tsx:270`, Contacts
`clients/workspace/tabs/ContactsTab.tsx:125` (title; one primary).

Also affected by the `CountTabs` change (not in a `PageToolbar`): Client 360 section tabs
`clients/workspace/ClientTabs.tsx:27` (inside a `flex-col`, `ClientDetailPage.tsx:173`) and
`settings/components/integrations/SyncItemsPanel.tsx`. Not affected: the Clients list (`cc-toolbar`,
APT76 plan).

## 6. Files expected to change

| File                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/PageToolbar.tsx`                                                                                                                                                                                                                                                                                                    | Container-query layout (one row ≥ 48 rem toolbar width, 2 rows below, mobile unchanged); `data-page-toolbar` hook for the layout check              |
| `src/components/ui/CountTabs.tsx`                                                                                                                                                                                                                                                                                                      | Can shrink in a row; visible overflow affordance (fade + scroll buttons); keeps the selected tab in view                                            |
| `src/components/ui/SearchField.tsx`                                                                                                                                                                                                                                                                                                    | `min-w-40` so it shrinks 241 → 160 px and never below                                                                                               |
| `src/components/ui/Button.tsx`                                                                                                                                                                                                                                                                                                         | New optional `compactLabel` prop (icon-only inside a narrow toolbar, label kept as the accessible name and the tooltip)                             |
| `src/components/ui/ColumnVisibilityMenu.tsx`                                                                                                                                                                                                                                                                                           | `compactLabel` on its button (covers 26 lists)                                                                                                      |
| Export buttons in toolbars: `billing/pages/InvoicesPage.tsx` (Export CSV), `time/pages/TimeEntriesPage.tsx`, `team/pages/StaffMembersPage.tsx`, `team/pages/RateHistoryPage.tsx`, `time/pages/TeamTimesheetsPage.tsx`, `reports/components/ExportMenu.tsx`, `time/components/analysis/ExportMenu.tsx`, `wip/components/ExportMenu.tsx` | One prop each (`compactLabel`), so "Export" behaves the same on every list. `audit/components/ExportMenu.tsx` is not in a `PageToolbar` – untouched |
| `src/features/billing/pages/InvoicesPage.tsx`                                                                                                                                                                                                                                                                                          | (Only if Q5 = yes) move the "Selected invoices" group out of `actions` to its own row under the toolbar, as Jobs does                               |
| Tests: `src/components/ui/dataDisplay.test.tsx` (CountTabs), `src/components/ui/Button.test.tsx`, new `src/components/ui/PageToolbar.test.tsx`                                                                                                                                                                                         | See §13                                                                                                                                             |
| `tests/e2e/toolbar-layout.spec.ts` (new, local only, opt-in by env)                                                                                                                                                                                                                                                                    | Layout check (§13) – owner may prefer to keep it out of the repo                                                                                    |
| `docs/ui-standards.md`                                                                                                                                                                                                                                                                                                                 | §1 rows for `PageToolbar`, `CountTabs`, `Button` (`compactLabel`), `SearchField`; §2.16 responsive table                                            |

Not changed: the 7 `FilterPopover` copies (Filter keeps its label and count – Q6), `Tooltip.tsx`
(unless Q4 = Tooltip), `buttonStyles.ts`, `theme.css`, any API/DB.

## 7. Proposed solution

### 7.1 `PageToolbar` – layout from the toolbar's width (container queries)

The card becomes a named container; an inner div does the layout (a container cannot query
itself). Slot order, roles and text are unchanged.

```tsx
// PageToolbar.tsx (sketch, not applied)
<div
  data-page-toolbar=""
  className={cn('@container/toolbar rounded-xl border border-border bg-surface p-2', className)}
>
  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center @3xl/toolbar:flex-nowrap">
    {/* Below 48rem the group dissolves (display: contents) so tabs, search and actions wrap as
        siblings: tabs first, then search + actions. From 48rem it is the left half of one row. */}
    <div className="contents @3xl/toolbar:flex @3xl/toolbar:min-w-72 @3xl/toolbar:flex-1 @3xl/toolbar:items-center @3xl/toolbar:gap-2.5">
      {start}
      {search}
    </div>
    <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:ml-auto sm:justify-end @3xl/toolbar:flex-initial">
      {actions}
      {primaryAction}
    </div>
  </div>
</div>
```

How it behaves (inner width = toolbar width − 18 px):

| Toolbar inner width                                                                             | Layout                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 48 rem (768 px): every laptop 1280–1920 at 90–110 %, 1024 @ 90 %, 1024 with sidebar collapsed | **One row, never wraps.** Right group = its natural width (`flex: 0 1 auto`), right-aligned. Left group takes the rest (`flex: 1 1 0`) but never less than 18 rem (288 px). Inside it the tabs shrink and scroll; the search shrinks from 241 to 160 px (both shrink by their width, as in the APT76 rule) |
| Right group wider than the room left (e.g. Invoices bulk selection on a 1280 laptop)            | The right group wraps **inside itself**, right-aligned; nothing overflows the page                                                                                                                                                                                                                         |
| < 48 rem, ≥ `sm` (1024 @ 100 % with sidebar, 768 tablets)                                       | **2 rows**: row 1 tabs (full width, scrollable); row 2 search + actions, actions right-aligned (`ml-auto`). Short toolbars (Leads, Expense types) stay on one row                                                                                                                                          |
| < `sm` (phones)                                                                                 | As today: tabs, full-width search and actions stacked                                                                                                                                                                                                                                                      |

Why container queries: they follow the real space (sidebar open/collapsed, browser zoom, Windows
scaling) and remove the 4–5-row jump at exactly 1024 px. Supported in all current browsers; built
into Tailwind 4.3.3 (verified).

`data-page-toolbar` is an inert attribute used by the layout check (§13).

### 7.2 `CountTabs` – shrinkable, overflow made visible, selected tab kept in view

```tsx
// CountTabs.tsx (sketch)
<div className={cn('relative flex max-w-full min-w-0 items-center rounded-md border border-border bg-surface', className)}>
  <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown}
       className="relative flex min-w-0 items-center gap-1 overflow-x-auto px-[5px] py-0.5">
    {/* tab buttons exactly as today (l.62-87) */}
  </div>
  {edges.start ? <ScrollEdge side="start" onClick={() => page(-1)} /> : null}
  {edges.end ? <ScrollEdge side="end" onClick={() => page(1)} /> : null}
</div>

// ScrollEdge: absolutely positioned over the end of the strip (no layout shift), a surface→transparent
// gradient fade plus a ChevronLeft/ChevronRight button:
<button type="button" tabIndex={-1} aria-hidden="true"
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-end bg-linear-to-l from-surface …">
```

- `shrink-0` removed (l.55) so the strip can give way in a row; `max-w-full` kept for wrap layouts.
- `edges` = `{ start: scrollLeft > 1, end: scrollWidth − clientWidth − scrollLeft > 1 }`, updated on
  `scroll`, by a `ResizeObserver` (guarded `typeof ResizeObserver !== 'undefined'`, as
  `OverflowNav.tsx:83`) and after every render (state set only when it changes – no loop).
- Scroll buttons page by 80 % of the visible width (`scrollBy({ left, behavior: 'smooth' })`). They
  are `aria-hidden` and `tabIndex={-1}`: keyboard and screen-reader users already reach every tab
  with ←/→/Home/End (focus scrolls the tab into view). The tablist contains only tabs, as today.
- When `value` changes (or on mount) the selected tab is scrolled into view by setting
  `list.scrollLeft` from `offsetLeft` (no `scrollIntoView`: it could scroll the page and is missing
  in jsdom).
- In jsdom nothing has a size → no edges → **no extra buttons rendered**; existing tests see the
  same accessibility tree.

**Option M – "More" menu** (alternative, Q2): `CountTabs overflow="menu"` shows the tabs that fit
plus a "More" `Dropdown` after the tablist; the selected tab always stays visible – the same
approach as `OverflowNav` (`useFitCount`, l.52-90, active kept l.96-101), which would move to
`components/ui` (the import boundary forbids `ui` → `layout`). Costs: ~100 more lines, arrow keys
must skip folded tabs, folded statuses are one click further away, a second pattern for status tabs.
Unit tests stay green (unmeasurable DOM = everything fits, l.62-65). Usable for Invoices only.

**Recommendation: the scroll affordance for every `CountTabs`** (one pattern, keyboard unchanged,
smallest change); Option M only if Raj wants Invoices' rarer statuses behind "More".

### 7.3 `SearchField` – shrink 241 → 160 px

`SearchField.tsx:28`: `'relative w-full sm:w-[241px]'` → `'relative w-full min-w-40 sm:w-[241px]'`.
In the one-row toolbar it is a flex item with `flex-shrink: 1`, so this equals the APT76 rule
`flex: 0 1 241px; min-width: 160px`. Elsewhere it changes nothing (it is 241 px or full width).
Pages that pass another control in `search` (Time entries' date range, Time analysis, Reports) keep
their own widths.

### 7.4 Icon-only secondary actions – `Button compactLabel`

```tsx
// Button.tsx (sketch)
export interface ButtonProps … {
  /** In a narrow PageToolbar (< 72rem) only the icon shows; the text stays the accessible name
   *  and becomes the tooltip. Use with `leftIcon` and a text label. */
  compactLabel?: boolean;
}
…
<button
  title={compactLabel && typeof children === 'string' ? children : undefined}
  className={cn(buttonClasses(…), compactLabel && '@max-6xl/toolbar:px-1.5', className)}
  {...rest}   // an explicit title still wins
>
  {loading ? <Spinner size="sm" /> : leftIcon}
  {compactLabel ? <span className="@max-6xl/toolbar:sr-only">{children}</span> : children}
  {!loading && rightIcon}
</button>
```

- Pure CSS: below a 72 rem toolbar (window ≤ ~1440 at 100 % with the sidebar open) the label is
  visually hidden but stays in the DOM → `getByRole('button', { name: 'Show/Hide Columns' })` and
  every other existing query keep working. Outside a `PageToolbar` the named container does not
  exist, so the variant never applies (no change in dialogs, cards, Client 360 headers).
- Opted in: `ColumnVisibilityMenu` and the Export buttons listed in §6. **Not** opted in: Filter
  (keeps its label and active-count badge – Q6), the primary button, toggles without an icon (My
  jobs, Work ready to bill only), bulk buttons with counts (Approve selected (N), Issue N…).
- Tooltip: native `title` (option T1, recommended), the same mechanism as the row icons
  (`RowActions`). It is also present while the label is visible (harmless). Option T2: wrap in
  `Tooltip` and give `Tooltip` a check at show time ("only when the label is visually hidden") –
  shows on keyboard focus too, ~15 more lines (Q4).
- Threshold `6xl` (72 rem) keeps labels at 1600 and 1920, where the labelled toolbars fit.

### 7.5 Invoices bulk selection

Today the "Selected invoices" group (≈ 600 px with Issue / Submit / Email / Delete / Clear) is the
first item of `actions` (`InvoicesPage.tsx:449-505`). With 7.1 it never overflows: the right group
wraps inside itself, right-aligned – but while rows are selected the tabs/search keep only the
288 px minimum at 1440. Recommended (Q5): render the group as its own row under the toolbar, inside
the same `DataTable toolbar` fragment, exactly as Jobs does (`JobsPage.tsx:322-331`) and WIP details
(`WipDetailsPage.tsx:361-365`). The group keeps `role="group"` and its name; `InvoicesBulk.test.tsx`
queries it by role (l.108, 174, 190), so it keeps passing. If not approved, 7.1 alone still prevents
overflow.

### 7.6 Expected result (estimates; confirmed by §13)

| Window @ zoom (CSS px)          | Invoices                                                           | Jobs                                   | My Expenses / others in the top 10                     |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------ |
| 1920 @ 100                      | 1 row, labels; ~870 of ~950 px tabs visible (end arrow on Overdue) | 1 row, all tabs                        | 1 row, all tabs                                        |
| 1600 @ 100                      | 1 row, labels; ~615 px tabs visible                                | 1 row, all tabs                        | 1 row (Expense claims: ~496/502)                       |
| 1440 @ 100                      | 1 row, icons; ~660 px (≈7 of 10 tabs)                              | 1 row, icons, **all tabs**             | 1 row, all tabs                                        |
| 1366 @ 100                      | 1 row, icons; ~600 px                                              | 1 row; Cancelled half behind the arrow | 1 row, all tabs (Expense claims ~433/502)              |
| 1280 @ 100 / 110                | 1 row; ~510 / ~395 px                                              | 1 row; ~460 / ~380 px                  | 1 row (Payments, Estimates: last tab behind the arrow) |
| 1024 @ 100 (sidebar open) / 768 | 2 rows: tabs; search + actions                                     | 2 rows                                 | 1–2 rows                                               |
| 1024 @ 90                       | 1 row; ~370 px                                                     | 1 row; ~365 px                         | 1 row                                                  |

No horizontal page overflow at any width; every hidden tab reachable by the arrow, scrolling or the
keyboard.

## 8. UI changes

Toolbar layout on all 57 lists; tab strip gets fades/arrows only when it overflows; Show/Hide
Columns and Export show as icon buttons (with tooltip) when the toolbar is narrower than 72 rem;
search may be 160–241 px wide. No text, order, colour, permission or behaviour changes. Invoices
bulk selection on its own row (if Q5 approved).

## 9. API changes

None.

## 10. Database changes

None.

## 11. Edge cases

- Toolbars with only actions (Reminder log, Write-offs): empty left group still fills the row; actions right-aligned (as today).
- `start` that is not tabs (titles, date fields, period navigator, selects, "Select all" label): in the one-row left group they are flex items with automatic minimum (no squeeze below their content in practice: the left group is ≥ 288 px).
- `search` that is not a `SearchField` (Time entries, Time analysis, Reports): keeps its own width.
- Permissions removing buttons (no Create/Export/Columns): fewer items, same rules.
- Loading Export: the spinner replaces the icon (`Button.tsx:42`); still icon-sized.
- Active filters: Filter keeps "Filter" + count.
- Deep link to a late tab (`?tab=overdue`, `?status=returned`): selected tab scrolled into view.
- Counts arriving after first render (tabs widen): the observer/after-render check updates the arrows.
- Sidebar collapsed (72 px): more room → one row from smaller windows.
- Browser zoom 75–125 % and Windows scaling 125 %: covered by container width.
- RTL: not supported by the app today; arrows use `start`/`end` positioning anyway.
- Dark theme: fades use the `surface` token.
- Popovers (Filter, Columns, Export) anchored to icon-only buttons: `Popover` flips/stays in the viewport.
- LEADS-01 lands first or later (§15).

## 12. Regression risks

| Risk                                                                                                                         | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared change reaches 57 lists                                                                                               | Layout check of the main lists at all widths (§13) + screenshot review; full UI suite                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `container-type: inline-size` gives an element no intrinsic width: a toolbar placed in a shrink-to-fit parent would collapse | All 49 `DataTable toolbar` uses are stretched (`DataTable.tsx:192`); the 8 others checked: `ExpenseApprovalsPage.tsx:164` and `TimesheetApprovalsPage.tsx:221` (`flex flex-col`), `MyTimesheetPage`/`TimeAnalysisPage` (time `PageShell` `flex-col`, `time/components/PageShell.tsx:18`), `ReportScreen` (fragment under the shell's `flex-col`, `AppShell.tsx:64`), `ReceiptsPage`/`WipDetailsPage` (into `DataTable toolbar`), `JobsPage` (fragment in `DataTable toolbar`) – re-checked in the browser |
| `display: contents` on the left group (tablet/phone)                                                                         | A plain `div` with no role – no accessibility loss; widely supported                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tests that count buttons or read `className`                                                                                 | Scroll buttons are not rendered in jsdom and are `aria-hidden`; labels stay in the DOM; no test asserts toolbar classes (grep)                                                                                                                                                                                                                                                                                                                                                                            |
| `title` adds an accessible description equal to the name                                                                     | Same as `RowActions` today; browsers do not repeat an identical description                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Search narrower (160 px) truncates long placeholders ("Search by client name or code")                                       | Accepted in APT76; `aria-label` unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CountTabs` without `shrink-0` in other layouts (`ClientTabs`, `SyncItemsPanel`)                                             | In a wrapping or column layout nothing changes (shrink applies only inside a full line); both checked in the browser                                                                                                                                                                                                                                                                                                                                                                                      |
| Invoices bulk row move (Q5) changes DOM order of the group                                                                   | Tests query by role/name; visual check                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CRLF files                                                                                                                   | Edit with the Edit tool; check formatting with `tr -d '\r' …                                                                                                                                                                                                                                                                                                                                                                                                                                              | npx prettier --check` (CLAUDE.md) |

## 13. Testing strategy

**Unit (Vitest, `--maxWorkers=2 --testTimeout=120000`)** – existing tests must pass unchanged:

- `dataDisplay.test.tsx` CountTabs test (role tab, arrow keys) – unchanged.
- New CountTabs tests: with a stubbed `scrollWidth`/`clientWidth` (as `BarChartImpl.test.tsx:25-43`
  stubs `ResizeObserver`), the end edge appears, clicking it calls `scrollBy`; the selected tab sets
  `scrollLeft`; without overflow no extra element is rendered.
- `Button.test.tsx`: `compactLabel` keeps the accessible name, sets `title`, wraps the label in the
  compact span; without the prop the DOM is unchanged.
- New `PageToolbar.test.tsx`: slots render in order (start, search, actions, primary), `data-page-toolbar` present.
- Page suites that query toolbar buttons by name: Invoices (`InvoicesPage*.test.tsx`,
  `InvoicesBulk.test.tsx`), Jobs, Expenses, Staff, Time entries, Leads, ExportMenu tests – run as
  they are; then the full suite (shared component).
- Type check, lint, Prettier (CRLF-safe), production build.

**Layout check (Playwright, local only, sequential; not run for this plan)** – `tests/e2e/toolbar-layout.spec.ts`,
skipped unless `TOOLBAR_LAYOUT=1`, against a local API with a seeded practice (≥ 1 invoice, job,
claim, lead, time entry, payment, credit note; an Owner login), sidebar open:

- Pages: Invoices `/:org/billing/invoices`, Jobs `/:org/jobs`, My Expenses `/:org/expenses/mine`,
  Expense Claims `/:org/expenses/claims`, Leads `/:org/clients/leads`, Time entries
  `/:org/time/entries`, Staff `/:org/team/staff`, Credit notes `/:org/billing/credit-notes`,
  Payments `/:org/billing/payments`.
- Windows 1920, 1600, 1440, 1366, 1280, 1024, 768 × zoom 90 / 100 / 110 % → viewport width =
  round(window / zoom), `deviceScaleFactor` = zoom (same CSS width as browser zoom).
- Per run, in `page.evaluate` on `[data-page-toolbar]` (baseline on `main`: the `.rounded-xl`
  ancestor of `main [role=tablist]` or of `input[type=search]`):
  1. **rows** = distinct `top` values (±4 px) of the visible controls (tab strip, search, buttons,
     links, selects) → expect ≤ 1 at 1280–1920 (all zooms) and 1024 @ 90 %; ≤ 2 at 1024 @ 100/110 % and 768;
  2. **no overflow**: `document.documentElement.scrollWidth <= innerWidth` and toolbar
     `scrollWidth <= clientWidth + 1`;
  3. **tabs reachable**: if the tablist overflows, an end arrow is visible; click it until it
     disappears → the last tab's rect is inside the strip; keyboard End on the selected tab focuses
     the last tab and it is visible; open `?tab=<last value>` → the selected tab is visible;
  4. search width (expect 160–241 px), label visibility of Columns/Export (compact span
     `position: absolute` below 72 rem), accessible names unchanged (`getByRole`);
  5. open Filter and Show/Hide Columns at 1280 → popover inside the viewport.
- Extra runs: Invoices with 2 rows selected at 1440 and 1280 (no overflow; bulk row placement);
  sidebar collapsed at 1024 and 1280; screenshots (before/after) of Invoices, Jobs, My Expenses at
  1920 / 1440 / 1280 / 1024 / 768 @ 100 %.

**Measurements still needed (run later, one at a time, low-RAM machine):**

1. Baseline on `main`: real natural widths – `tablist.scrollWidth` and each toolbar button's
   `offsetWidth` on the 9 pages – to replace the §5 estimates and confirm the 48 rem / 72 rem
   thresholds.
2. Whether Windows Chromium draws a classic horizontal scrollbar under an overflowing tab strip (it
   adds height; decides whether to hide the native scrollbar now that arrows exist).
3. Sidebar-collapsed widths at 1024 / 1280 (formula: window − 72 − 48).
4. After the change: the full matrix above (9 pages × 7 windows × 3 zooms = 189 runs) plus the
   extra runs; record rows / overflow / hidden-tab count / search width per run in a table in this file.
5. Cross-screen spot checks (screenshots, 1440 and 1024): Payments, Estimates, WIP details, Tasks,
   Team timesheets, Reports, Time analysis, Client 360 tabs (Time, Expenses, Payments), Debtors,
   Historic WIP, `ClientTabs`.

## 14. Acceptance criteria

1. Every listed page: **one toolbar row** at 1920, 1600, 1440, 1366, 1280 px windows at 90, 100 and
   110 % zoom (sidebar open) and at 1024 @ 90 %.
2. At 1024 @ 100/110 % (sidebar open) and 768 px: **at most two rows** – tabs, then search +
   actions (actions right-aligned). Phones (< 640 px) look as today.
3. No horizontal page scroll and no control cut off at any tested width.
4. Every status tab is reachable: when the strip overflows, a visible fade + arrow on each hidden
   side; arrows reveal the rest; ←/→/Home/End work as today; a deep-linked tab is visible on load.
5. Below a 72 rem toolbar, Show/Hide Columns and Export are icon buttons with an unchanged
   accessible name and a tooltip; Filter keeps its label and count; the primary button keeps its label.
6. The search is 241 px when there is room and never narrower than 160 px.
7. Invoices with rows selected: nothing overflows; the bulk actions stay usable (own row if Q5).
8. All existing unit/UI tests pass unchanged; new tests pass; type check, lint, format, build pass;
   no new React warnings.

## 15. Dependencies

- **LEADS-01** adds Show/Hide Columns and "Export selected" to the Leads toolbar
  (`TIMEFEE-LEADS-01-GRID-PARITY.md` §2, l.53-64). Columns collapses automatically through
  `ColumnVisibilityMenu`; "Export selected" should get `compactLabel` (one prop). Either order works:
  if LEADS-01 merges first, add the prop in TOOLBAR-01; if TOOLBAR-01 first, LEADS-01 adds it.
  Estimated Leads width after LEADS-01: ~972 px – one row at every laptop width with this plan.
- **APT76 follow-up (Clients `cc-toolbar`)** – same rules kept: one row with groups not wrapping
  against each other, search `flex: 0 1 241px; min-width: 160px`, wrapped actions right-aligned.
  Differences: APT76 switches at a viewport `min-width: 1024px` media query and has no tab overflow
  or icon-only step. Its plan text "PageToolbar … from lg (1024 px) the two groups share one row"
  (APT76 §3) becomes outdated – update when either lands. Optional follow-up: switch the Clients
  CSS to `@container` with the same 48 rem threshold so Clients and Leads change layout at the same
  width (plain CSS supports it; no markup change).
- **TIMEFEE-CLIENT-LEADS-CONSISTENCY-PLAN** – if Leads moves to the Clients `cc-*` look (its Option
  2), Leads leaves `PageToolbar` and follows APT76 instead.
- Release: UI only, no API PR needed; full UI suite before merge (shared component); live check of
  the changed lists after merge.

## 16. Questions for Raj / the lead

1. **Icon-only:** below ~1440 px (toolbar < 72 rem), may Show/Hide Columns and Export show as icon
   buttons with a tooltip (accessible name kept)? Filter and the primary button stay labelled.
2. **Invoices tabs:** all 10 statuses in a scrollable strip with fade + arrows (recommended, same as
   every list), or the main statuses + "More" menu (Option M)?
3. **1024 px with the sidebar open:** accept the 2-row tablet layout there (recommended – it is the
   same 736 px as a 768 tablet), or force one row down to 42 rem (tabs get ~300 px on Invoices)?
4. **Tooltip:** native `title` like the row icons (recommended), or the `Tooltip` component (also on
   keyboard focus, a little more code)?
5. **Invoices bulk actions:** move "Selected invoices" to its own row under the toolbar like Jobs
   (recommended), or keep it inside the toolbar (toolbar becomes 2 rows while selecting)?
6. **Filter:** keep it labelled (recommended: it shows the active-filter count), or collapse it too?
7. May the opt-in Playwright layout spec be committed (`TOOLBAR_LAYOUT=1`), or kept local?

**Decided 9 Nov 2026 (owner):**

1. Yes: below ~1440 px (toolbar < 72 rem) Show/Hide Columns and Export become icon-only buttons
   with a tooltip; the accessible name is kept. Filter and the primary button keep their labels.
2. Invoices: all 10 status tabs in one scrollable strip with fade + arrows (same as every list).
   Option M is not built.
3. 1024 px with the sidebar open: the 2-row tablet layout is accepted.
4. Tooltip: native `title` (like the row icons).
5. Invoices "Selected invoices" bulk bar moves to its own row under the toolbar, like Jobs.
6. Filter stays labelled (it shows the active-filter count).
7. The opt-in Playwright layout spec (`TOOLBAR_LAYOUT=1`) may be committed.

Scope of this ticket: §7.1–§7.5. R-14 (Clients `cc-toolbar`, APT76 follow-up) is a later ticket.

## 17. Implementation sequence (after approval)

1. `CountTabs` (shrink, edges, selected in view) + unit tests.
2. `SearchField` `min-w-40`; `Button compactLabel` + tests; `ColumnVisibilityMenu` + Export opt-ins.
3. `PageToolbar` container layout + test.
4. Invoices bulk row (if Q5).
5. Local layout check (§13) – sequential, one browser; fill in the results table.
6. `docs/ui-standards.md` §1 / §2.16; mark `TIMEFEE-RESPONSIVE-ISSUES.md` as planned here.
7. Full UI suite, type check, lint, format, build; screenshots for review; PR (no merge without approval).

## 18. Implementation notes (9 Nov 2026, base `61ebf18`)

References re-checked against `61ebf18`: the shared components (`PageToolbar.tsx:29-45`,
`CountTabs.tsx:35-91`, `SearchField.tsx:28`, `Button.tsx:19-46`, `ColumnVisibilityMenu.tsx:41-51`)
are as in §3. Invoices: `PageToolbar` l.430, bulk group l.449-507, Export CSV l.536-544. Leads
(after LEADS-01, now on `main`): `PageToolbar` l.383, Show/Hide Columns l.405, "Export selected"
l.414-422 – it gets `compactLabel` here (§15). No `PageToolbar` caller passes `className`.

Differences from the §7 sketches (same intent):

- `Button`: `title` is destructured, so `title={title ?? <label>}`. The three report `ExportMenu`s
  pass `title={allowed ? undefined : '…'}`; with the sketch's `{...rest}` order that explicit
  `undefined` would have removed the tooltip. An explicit title still wins.
- Invoices bulk row: the Jobs wrapper classes (`border-b border-row-border px-4 py-2`) are put on
  the existing `role="group"` div instead of a second wrapper div.
- `CountTabs`: the `className` prop goes on the new outer box (the bordered strip), so
  `ClientTabs`' `self-start` keeps working.
- Docs: `docs/ui-standards.md` §1 (`PageToolbar`, `Button`, `SearchField`, `CountTabs`) and §2.16.
  `TIMEFEE-RESPONSIVE-ISSUES.md` is not in this branch, so it is not marked.

### 18.1 Browser layout check (10 Nov 2026, local stack)

The §13 spec (`tests/e2e/toolbar-layout.spec.ts`) ran on the local stack: **25 / 25 passed**
(9 pages × 7 widths × 3 zooms, Invoices with rows selected, sidebar collapsed).

Found and fixed on the way:

- **`CountTabs` (product fix):** a deep link to a late tab (`?tab=overdue`) loaded with that tab
  out of view. The keep-in-view effect ran only on `value`, before the counts arrived and widened
  the tabs. It now also runs when the counts change (`[value, counts]`).
- **Spec fixes (the check, not the product):**
  - Expense Claims is at `/expenses`, not `/expenses/claims`.
  - Each test may take 5 minutes (9 pages), and the tests are no longer serial, so one failing width
    doesn't hide the others.
  - The sidebar toggle is waited for instead of `isVisible()`, which doesn't wait, so the sidebar is
    really collapsed.
  - The last-tab check polls up to 3 s, because the tab change re-renders through the router before
    it scrolls.
  - The header notes `AUTH_RATE_LIMIT_FACTOR=10` for the 25 sign-ins.

Known limitations, not changed here:

- **Time entries** puts a fixed-width `DateRangeField` (`sm:w-80`) in the search slot, and it stacks
  its quick ranges under the dates. Its toolbar is 2 rows taller than the layout at every width,
  **the same on `main`**. The spec allows exactly those 2 extra rows (`EXTRA_ROWS`). A one-row
  date range needs its own ticket.
- At 160 px the Invoices search placeholder is cut ("Search number o…"); its accessible label is whole.
- The local practice has no payments, credit notes or expense claims, and only one invoice, so
  those toolbars were measured with empty lists.

### 18.2 Spot-check of the other toolbar pages (10 Nov 2026, after review)

Pages outside the spec, checked on the local stack at 1440 px, 1024 px @ 90 %, 1024 px with the sidebar collapsed and 768 px. Each one was compared with `main`:

- Time analysis (Time and Reports)
- Utilisation and Billing reports
- Historic WIP, WIP Summary and Debtors
- The Client 360 Jobs, Time, WIP, Invoices, Payments and Expenses tabs

The check looked for controls cut off at the window edge, controls overlapping, page overflow and toolbar height. None of these pages had a control cut off, an overlap or page overflow.

**One regression, found and fixed.** On the Client 360 Time and Expenses tabs, the toolbar went from one row on `main` to two rows (at 1024 @ 90 % and with the sidebar collapsed).

- **Cause:** the left group always kept 18rem (`min-w-72`). When it holds only a title, that squeezed the date range, the selects and the button onto a second row.
- **Fix:** the left group keeps 18rem only when it holds a tab strip (`@3xl/toolbar:has-[[role=tablist]]:min-w-72`).
- **Result:** every checked page is as good as `main` or better (the Client 360 Jobs and WIP tabs go from 2 rows to 1 at 768 px). The layout spec still passes 25 / 25.
