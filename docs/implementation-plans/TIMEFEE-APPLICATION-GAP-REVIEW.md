# TimeFee: application gap review (menus, navigation, leads, phases)

Requested 7 Nov 2026 on Raj B's report: menus missing, Clients disappears on Leads, navigation
missing in places, synthetic data for Leads, a phase missing, other gaps. Code reviewed at UI
`main` a2dd183 and API `main` 7141e65 (both repos' latest).

## 1. Project understanding

Capium Time & Fees: time recording, WIP, billing and fee accounting for UK accountancy
practices. React UI (this repo) and FastAPI API (`capiumtimenfeeapi`). The UI menu is
data-driven: `src/constants/navigation.ts` defines 10 modules and their pages. The top bar shows
the modules. Every module except Clients shows its pages in a left `Sidebar` (desktop) or tabs
and `MobileDrawer` (below lg). Route guards (`routes.tsx:47-56`) use the same `anyOf` rule as
the menu, so menu and guard always agree. Mismatches can only be against a page's own check or
the API's permission.

## 2. Documentation reviewed

- **UI:** `CLAUDE.md`, `docs/system-overview.md`, `architecture.md`, `module-map.md`,
  `ui-standards.md`, `coding-standards.md`, `testing.md`.
- **API:** `CLAUDE.md`, `docs/system-overview.md`, `flow.md`, `domain.md`, `plan.md`,
  `api-reference.md`, `database.md`, `modules/clients.md` (leads), `modules/reports.md`,
  `modules/team-rates.md`, `modules/tickets.md`, `implementation-plans/APT81.md`.

## 3. Graphify findings

- The graph at `C:\Users\pc\capium-graph\graphify-out` (built 5 Nov) maps UI → API calls
  (`http_calls`). It predates APT81 phases A–D, so it is stale for overtime.
- The route-to-caller check was re-run on current code: 446 API operations matched to UI call
  sites, and the unmatched ones were checked by hand (§11).
- The graph was not modified.

## 4. Current structure

| Module                                                                                | Pages in the menu (desktop)                                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard, Time, Jobs, Expenses, WIP, Billing & Fees, Reports, Team & Rates, Settings | Left sidebar, grouped                                                                                                                                                                                    |
| **Clients**                                                                           | **None**: `NO_SUBNAV_MODULES = ['clients']` (`navigation.ts:135`). Client List, Client Overview and Leads are defined but have no desktop menu. The Client List toolbar has its own Clients/Leads switch |

## 5. Expected structure (from the docs)

- Every module's pages are reachable from its menu, and the active item is correct on detail
  pages and after a refresh.
- `plan.md:33` lists 8 v1 reports including **VAT summary**.
- `module-map.md` lists the routes of each module.

## 6–11. Findings

**Status key:** C = confirmed in code, S = suspected, Q = needs clarification.

| ID   | Issue                                                                                                                                                                                                        | Expected                                                                                   | Actual                                                                                                                                                                                                                                                                                                                                                        | Evidence                                                                                                              | Root cause                                                                                  | Fix                                                                                                                                               | Pri  | St  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- |
| G-01 | **Clients disappears on Leads** (Raj issue 2)                                                                                                                                                                | Clients and Leads both stay reachable under Clients                                        | The Clients/Leads switch is only in the Client List toolbar. Leads has only a "← Client List" button. Clients has no side menu, and desktop and mobile differ                                                                                                                                                                                                 | `ClientsToolbar.tsx:74-85`; `LeadsPage.tsx:459-472`; `navigation.ts:135`; `Sidebar.tsx:65`; `MobileDrawer.tsx:93-130` | Clients is the one module excluded from the side menu, so its pages depend on in-page links | Give Clients the left sidebar like every other module (Client List, Leads, Client Overview); remove it from `NO_SUBNAV_MODULES`                   | High | C   |
| G-02 | Client Overview (`/clients/360`) unreachable by click on desktop                                                                                                                                             | In the menu                                                                                | Only Search and the mobile drawer reach it                                                                                                                                                                                                                                                                                                                    | `navigation.ts:284-291`                                                                                               | Same as G-01                                                                                | Fixed by G-01                                                                                                                                     | Med  | C   |
| G-03 | **VAT Summary report missing** (Raj: "missing areas")                                                                                                                                                        | In Reports (v1 scope)                                                                      | API `GET /reports/vat-summary` exists; no UI page, menu entry or loader. `src/constants/reports.ts` lists it but nothing imports that file                                                                                                                                                                                                                    | API `reports.py:276-294`, `plan.md:33`; UI `pageLoaders.ts:72-86`                                                     | Never built in the UI                                                                       | New config-driven report (`ReportScreen`), gated by `report.financial`, under "Billing & cash"                                                    | High | C   |
| G-04 | Lock Past Periods hidden from Manager and Billing                                                                                                                                                            | They hold `period_lock.read`; the page checks it                                           | Menu and guard require `settings.manage`/`organization.update`                                                                                                                                                                                                                                                                                                | `navigation.ts:772-778`; `PeriodLockPage.tsx:20`                                                                      | Menu rule ≠ page rule                                                                       | `anyOf: [periodLockRead, periodLockManage]`                                                                                                       | High | C   |
| G-05 | Import/Export hidden from roles the page allows (e.g. Billing for opening balances, which redirects them to "No access")                                                                                     | Page allows `client.read`, `client.create`, `data.import_export`, `opening_balance.import` | Menu and guard: `settings.manage`/`organization.update`                                                                                                                                                                                                                                                                                                       | `navigation.ts:817-824`; `ImportExportPage.tsx:16`; `routes.tsx:156`                                                  | Menu rule narrower than the page                                                            | `anyOf` = the page's list                                                                                                                         | High | C   |
| G-06 | Expense claim detail: no menu item active                                                                                                                                                                    | Expense Claims stays active                                                                | Nothing marked                                                                                                                                                                                                                                                                                                                                                | `navigation.ts:424-430` (segment `''`); `pageLoaders.ts:153-157`                                                      | Index page with a non-index detail path                                                     | `alsoActiveOn: ['claims']`                                                                                                                        | Med  | C   |
| G-07 | Working hours can't be deleted in the UI                                                                                                                                                                     | API `DELETE /staff/{uid}/hours/{id}` (APT81 phase A)                                       | List and add only                                                                                                                                                                                                                                                                                                                                             | `teamApi.ts:178-180`                                                                                                  | Phase A UI contract left it out                                                             | Delete with confirm, `member.update`                                                                                                              | Low  | C   |
| G-08 | **No synthetic/demo data tool** (Raj issue 4)                                                                                                                                                                | A safe seed command                                                                        | None for leads (or anything); `app/maintenance` has only bootstrap and reset                                                                                                                                                                                                                                                                                  | API `app/maintenance/`; `plan.md:165-166`                                                                             | Never built                                                                                 | API `python -m app.maintenance.seed_leads`: dry run by default, refuses production, goes through `LeadService` (validation + audit), idempotent   | High | C   |
| G-09 | Doc drift                                                                                                                                                                                                    | Docs match code                                                                            | `module-map.md` lacks overtime-rates and staff-cost. API `clients.md:496` convert body lacks `branch_id`. `flow.md` and Help lack Overtime, WIP adjustment and recurring statuses, and Job "Cancelled"                                                                                                                                                        | as cited                                                                                                              | Not updated                                                                                 | Update the docs                                                                                                                                   | Low  | C   |
| G-10 | Settings shows "Practice" twice                                                                                                                                                                              | One Practice section                                                                       | Two runs, Access control between                                                                                                                                                                                                                                                                                                                              | `navigation.ts:751-788`                                                                                               | Page order                                                                                  | **Not changed:** merging moves where Settings opens for a role without `organization.read` (to Branches; `orgRouting.test.tsx`). Needs a decision | Med  | Q   |
| G-11 | **Which phase is missing** (Raj issue 5)                                                                                                                                                                     | —                                                                                          | Candidates, strongest first: (1) APT81 "deliberate recalculation" of overtime after hours/rates change. Required (`APT81.md:15-17,133-134`) but outside phases A–D, never built. (2) Lead → prospect ("Draft") client: conversion always creates an active client (`services/leads.py:163`). (3) Engagement-based recurring invoicing (`plan.md:38`, backlog) | as cited                                                                                                              | —                                                                                           | Ask Raj which; (1) needs its own plan (preview/apply like re-rate)                                                                                | High | Q   |
| G-12 | Lead pipeline stages, owner, follow-up, quotes for leads                                                                                                                                                     | —                                                                                          | Leads are open/converted/archived only; estimates need a client                                                                                                                                                                                                                                                                                               | `schemas/leads.py:15`; `estimates.py:106`                                                                             | No requirement                                                                              | Clarify                                                                                                                                           | —    | Q   |
| G-13 | Subscription expired/suspended: no explanation in the UI                                                                                                                                                     | Banner                                                                                     | API 403 `SUBSCRIPTION_UNAVAILABLE`; UI has no handling                                                                                                                                                                                                                                                                                                        | `transport.ts:248`                                                                                                    | Not built                                                                                   | Clarify, then a banner                                                                                                                            | Low  | S   |
| G-14 | Menu rules for custom roles differ from the API (Client Statements, Time Analysis, Integrations, Debtors, Onboarding)                                                                                        | —                                                                                          | System roles unaffected                                                                                                                                                                                                                                                                                                                                       | `navigation.ts:334-339,574,578-583,811-816,836`                                                                       | —                                                                                           | Align once confirmed                                                                                                                              | Low  | S   |
| G-15 | Same page in several modules (Time Analysis, My Timesheet, Missing Timesheets, WIP Ageing, Debtors); one-page modules lose the sidebar; single-page groups in Settings; Activity Types vs Services placement | —                                                                                          | —                                                                                                                                                                                                                                                                                                                                                             | `pageLoaders.ts:36,73`; `Sidebar.tsx:79`                                                                              | Design                                                                                      | Raj to decide                                                                                                                                     | Low  | Q   |
| G-16 | Ticket tags rename/delete; job task reorder; unlink a job from practice management                                                                                                                           | API exists                                                                                 | No UI                                                                                                                                                                                                                                                                                                                                                         | `ticketsApi.ts:113-117`; API `api-reference.md:368`; `pm_integration.py:185-195`                                      | Not built                                                                                   | Separate small tickets                                                                                                                            | Low  | C   |

**Correction:** on 6 Nov I said Branches and Client Segments are shown to roles that are then
refused. The code shows they are open to every member (`BranchesPage.tsx:60`; API
`branches.py:34`, `segments.py:43`), so that is not an issue.

## 12. Root causes (summary)

- Clients was deliberately excluded from the side menu (`NO_SUBNAV_MODULES`), leaving its pages
  to in-page links. Leads never got that link (G-01, G-02).
- Menu `anyOf` rules were written once and not kept in step with the page and API rules (G-04,
  G-05).
- A report built in the API was never wired into the UI (G-03).
- No seed tooling was ever built (G-08).

## 13–14. Files

- **UI:** `src/constants/navigation.ts`, `src/components/layout/Sidebar.tsx` (and SubNav
  comment), `src/features/reports/definitions/vatSummary.tsx` + page + `pageLoaders.ts`,
  `src/features/team/...` (Working hours delete), docs, tests.
- **API:** `app/maintenance/seed_leads.py`, a test, `README.md`/docs, `docs/modules/clients.md`,
  `docs/flow.md`.

## 15. API and database impact

No schema change and no new endpoint. The seed command writes only to the database it is
pointed at, refuses production, and runs only with `--yes`.

## 16–17. Dependencies and approach

- G-01 also fixes G-02.
- G-03 follows the existing config-driven report pattern.
- G-04, G-05 and G-06 are one-line rule changes.
- G-08 reuses `LeadService` and the bootstrap schema check.
- Each fix reuses an existing pattern: no new components or libraries.

## 18. Testing

- Unit/UI tests for each change: the Clients sidebar on list, Leads and client detail pages,
  including a direct load; menu rules per role; the VAT report; claim detail active state;
  Working hours delete.
- Full UI suite, `tsc`, ESLint, Prettier, build.
- API seed test on a test DB; ruff, mypy; CI on the PR.
- Manual check in the local app: every module's menu, Clients ↔ Leads both ways, refresh,
  back/forward.

## 19. Risks

- **G-01 narrows the Clients grid by the sidebar width.** The sidebar collapses to icons, and
  the choice is remembered. Raj has asked for wide Clients columns before (APT76), so check the
  toolbar and grid at 1366 px and 1920 px.
- **G-04 and G-05 widen access to pages the roles were already allowed by the page and API.**
  No new data access.

## 20. Sequence

1. UI: G-04, G-05, G-06 (rules).
2. G-01 (Clients sidebar).
3. G-03 (VAT report).
4. G-07.
5. G-09 docs.
6. API: G-08 seed and docs.
7. Tests and regression.
8. Report.

Q items wait for Raj.

## 21. Implementation (7 Nov 2026)

Sections 16–20 are the original plan. For G-01 Raj then chose the Clients | Leads tabs
instead of a sidebar; the table below is what was built.

| ID         | Done                                                                                                                                                                                                                                                                                 | Files                                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01       | Raj chose to keep the Clients page full width with no sidebar (screenshot, 7 Nov). A shared `ClientsLeadsSwitch` (Clients                                                                                                                                                            | Leads tabs, current one marked) now sits on the Client List toolbar and at the top of Leads, replacing the "Client List" back button. A sidebar was built first and removed at Raj's request. The grid's fixed `min-width: 1280px` was also removed, so the default columns fit without a sideways scroll | `components/ClientsLeadsSwitch.tsx`, `ClientsToolbar.tsx`, `pages/LeadsPage.tsx`, `styles/capium-clients.css`, `navigation.ts` (comment) |
| G-03       | VAT Summary report (`ReportScreen` config), page, loader, menu entry under "Billing & cash", page description                                                                                                                                                                        | `features/reports/definitions/vatSummary.tsx`, `pages/VatSummaryReportPage.tsx`, `types.ts`, `pageLoaders.ts`, `navigation.ts`, `pageDescriptions.ts`                                                                                                                                                     |
| G-04       | Lock Past Periods: `anyOf: [period_lock.read, period_lock.manage]`                                                                                                                                                                                                                   | `navigation.ts`                                                                                                                                                                                                                                                                                           |
| G-05       | Import/Export: `anyOf: [client.create, data.import_export, opening_balance.import]`. `client.read` was left out on purpose: read-only client export is on the Clients page, and adding it would show Import/Export to every member                                                   | `navigation.ts`                                                                                                                                                                                                                                                                                           |
| G-06       | Expense Claims `alsoActiveOn: ['claims']`. Found while testing: `activePageId` ignored `alsoActiveOn` for index pages, so it now checks it for every page                                                                                                                            | `navigation.ts`                                                                                                                                                                                                                                                                                           |
| G-07       | Working hours: delete, with confirm, for `member.update`                                                                                                                                                                                                                             | `team/api/teamApi.ts`, `team/api/overtime.ts`, `WorkingHoursCard.tsx`                                                                                                                                                                                                                                     |
| G-08       | API `python -m app.maintenance.seed_leads --practice-slug <slug> [--count N] [--yes]`: dry run by default, refuses `APP_ENV=production`, goes through `LeadService`, idempotent                                                                                                      | API `app/maintenance/seed_leads.py`, `tests/test_seed_leads.py`, `README.md`, `docs/testing.md`; `system_context` made public in `services/engagement_jobs.py`                                                                                                                                            |
| G-09       | Docs: module map (Clients                                                                                                                                                                                                                                                            | Leads tabs, VAT summary, Staff Cost, Overtime Rates); Help lifecycles (Overtime, WIP adjustment, recurring schedule, job cancelled); API `flow.md`, `clients.md`                                                                                                                                          | `docs/module-map.md`, `features/help/flowData.ts`, API docs                                                                              |
| G-17 (new) | Found while checking the app: the shared `Sidebar` used `NavLink`, which also marked a module's index page (Client List at `/clients`) as `aria-current` on every page below it. It is now a plain `Link`, as `ModuleSidebar` uses; the current page comes from `activePageId` alone | `components/layout/Sidebar.tsx`                                                                                                                                                                                                                                                                           |

No API endpoint and no database schema changed.

**Tests changed:**

- `Sidebar.test.tsx`: added "no sidebar for a module where the role may open one page only", "marks one page only on a page below a module index" (the NavLink fix) and Expense Claims marked on a claim. The Clients "no sidebar" test is unchanged. `ClientsLeadsSwitch.test.tsx` (new): the tabs on both pages. `LeadsPage.test.tsx`: the "Client List" back link became the Clients tab of the switch.
- `orgRouting.test.tsx`: the index-landing test's role now holds `period_lock.read`, the page's real rule. Added: Manager opens Lock Past Periods; Billing opens Import/Export.
- `TopBar.test.tsx`: the search "vat" now finds two pages (VAT Codes, VAT Summary), so it searches "vat codes". Added: search finds VAT Summary.
- New: `vatSummary.test.tsx` (rows, figures, period and client sent to the API, access refusal) and a Working hours delete test (permission, cancel sends nothing, delete).

**Manual check, local only:** the API on :8011 and the UI on :5174 against `capium_run_main`, with 12 sample leads added by the seed command.

- At 1280, 1366 and 1920 px: no sidebar on Clients; the client grid shows every default column with no sideways scroll; Leads shows the Clients | Leads tabs with Leads marked; F5 on Leads stays on Leads; the Clients tab and browser Back work.
- VAT Summary loads from the API.

Nothing was checked in production.
