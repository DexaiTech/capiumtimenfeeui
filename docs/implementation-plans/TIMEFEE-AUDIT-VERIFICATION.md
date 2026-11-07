# TimeFee audit: independent verification and release readiness (7 Nov 2026)

This verifies the fixes made for `TIMEFEE-COMPLETE-APPLICATION-AUDIT.md` (and the earlier
`TIMEFEE-APPLICATION-GAP-REVIEW.md` work in the same working tree).

- **Method:** I read the code and ran the tests. No application code was changed during
  verification, and no implementation agent ran during it.
- **Environment:** local only. API tests used the isolated test database
  `capium_test_seedleads`; the suite refuses any database whose name lacks "test"
  (`tests/conftest.py:29-30`). Production was not touched.

## 1. Snapshot verified

The snapshot was taken after the three implementation agents finished and before verification.
Files are in the session scratchpad `verify/`.

| Repo                                       | Branch   | HEAD      | Behind main        | Local commits                                                                          | Working tree                                                                          |
| ------------------------------------------ | -------- | --------- | ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| UI `C:\Users\pc\capiumtimenfeeui`          | `jaasir` | `8e1b7de` | 0 (main `a2dd183`) | 1: `8e1b7de` "Docs: unique list keys, full suite before merge, live check after merge" | 66 modified + 12 new files, uncommitted. Diff sha256 `94418eef52809b08` (2,805 lines) |
| API `C:\Users\pc\capiumtimenfeeapi-jaasir` | `jaasir` | `3fd855c` | 0 (main `7141e65`) | 3: `d079ed3` CLAUDE.md rules; `355e8a1` seed_leads command; `3fd855c` docs             | 22 modified, uncommitted. Diff sha256 `6d1523d770d43fb0` (873 lines)                  |

- Nothing is pushed, merged or deployed.
- The main API checkout (`C:\Users\pc\capiumtimenfeeapi`, branch `main`) has two untracked files
  that are not ours. They were left untouched: `AP_DevSecOps_Implementation_Plan.pdf` and
  `docs/devsecops/`.

## 2. Results: every fix, its status and evidence

**Status key:**

- **I** = implemented (present in the working tree).
- **T** = tested by an automated test written for it.
- **V** = independently verified by me: I read the diff against the finding and the API rule,
  and ran the tests.
- **P** = partial.
- **–** = not done.

### Wave 1 (audit SAFE-FIX)

| ID                                                           | Status          | Where (repo: files)                                                                                                                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REP-01 expense WIP in the WIP & Ageing report and dashboard  | I T V           | API: `app/repositories/reports.py` (`wip_items` adds an `expense_q` to the union), `app/schemas/reports.py`, `app/schemas/dashboard_pages.py`, `docs/modules/dashboard.md`, `docs/modules/reports.md`            | **Query:** scoped by `Expense.organization_id`; every join (job, client, claim) also matches on organisation. Counts billable lines with a recharge above 0 and a claim approved by the end of `as_at` in the practice time zone, using the same `_wip_status` as time. A person filter excludes expenses, as it does disbursements (`item_conditions`, `false()`). **Tests:** `test_reports_v2_consistency` (8), `test_reports_wip` (12), `test_dashboard` (8), all passing. See NEW-01 and NEW-02. |
| REP-03 WIP CSV export gate and audit row                     | I T V           | API: `app/api/v1/wip_reports.py`                                                                                                                                                                                 | `ensure_allowed` now runs before both branches. It only gates non-JSON formats (`report_export.ensure_can_export`), so viewing the report is unaffected. The CSV goes through `ReportExporter` and writes `report.exported`. **Tests:** `test_reports_v2_exports` (26) pass, including the new 403 and audit-row tests.                                                                                                                                                                              |
| BIL-02a expense WIP write-off and reversal                   | I T V           | API: `app/services/wip.py`, `app/api/v1/wip.py`                                                                                                                                                                  | Expense ids are collected and counted in the duplicate check. A whole-job write-off uses `job_expense_ids` (`wip_expense_conditions`, scoped to the organisation). The existing per-item checks (billable, unbilled, claim approved, recharge > 0, client match) cover expenses. Reversal now locks expense lines through `lock_allocation_items`. The schema already allowed `kind: "expense"`. **Tests:** `test_wip` (18) and `test_expense_wip` (9) pass.                                         |
| TIME-05 locked period (API part)                             | I T V           | API: `app/services/timesheets.py`, `app/schemas/time.py`                                                                                                                                                         | `period_locks.locked_through(organization_id, …)` fills the timesheet detail. **Test:** `test_period_lock_enforcement` (15) passes.                                                                                                                                                                                                                                                                                                                                                                  |
| CLI-04 budget totals (API part)                              | I T V; UI **–** | API: `app/schemas/job_budgets.py` (+`minutes_basis_logged`, `fee_basis_value`)                                                                                                                                   | Additive fields. `test_job_budgets` (8) passes. **The UI does not use them yet:** the Budget Tracking card still mixes the two bases. Planned for wave 2, which was not run.                                                                                                                                                                                                                                                                                                                         |
| CLI-09, CLI-13, CLI-14 docs and descriptions                 | I V             | API: `app/schemas/jobs.py`, `docs/modules/time.md`, `docs/modules/clients.md`                                                                                                                                    | Reviewed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| TIME-01 week-grid task rows                                  | I T V           | UI: `time/utils/grid.ts` (`rowKey` adds `task_id` only when set, so existing keys are unchanged), `types.ts`, `WeekView.tsx` (new cell sends `task_id`), `WeekGridTable.tsx`, `rowLabels.ts`, `test/handlers.ts` | Tests: `grid.test.ts`, `WeekView.test.tsx` (PATCH targets the task entry; POST carries `task_id`).                                                                                                                                                                                                                                                                                                                                                                                                   |
| TIME-02 exempt submit message and Undo                       | I T V (P)       | UI: `TimesheetStatusBar.tsx`                                                                                                                                                                                     | It now follows the status the submit returns. **Partial:** the button still says "Submit for approval" before submitting. Fixing that needs an exemption flag from the API.                                                                                                                                                                                                                                                                                                                          |
| TIME-04 self rule on correct, revoke and remove              | I T V           | UI: `TimeEntriesPage.tsx` (`canCorrect` adds the own-entry check plus `organization.update`), `PersonSheetDrawer.tsx`                                                                                            | It matches the API's `SELF_CORRECTION_FORBIDDEN` and `_ensure_not_self`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| TIME-05 (UI part)                                            | I T V           | UI: `TimeEntriesPage.tsx` (`!entry.period_locked_through`), `PersonSheetDrawer.tsx`                                                                                                                              | The drawer relies on the API part above. Without it the field is empty and Remove shows (degrades safely; the API still refuses with 409).                                                                                                                                                                                                                                                                                                                                                           |
| TIME-06, TIME-07 invalidation                                | I T             | UI: `time/api/invalidation.ts`, `dashboard/api/hooks.ts`                                                                                                                                                         | Tests: `invalidation.test.tsx`, `dashboard/api/hooks.test.tsx` (new).                                                                                                                                                                                                                                                                                                                                                                                                                                |
| TIME-08, TIME-09                                             | I T             | UI: `TimesheetStatusBar.tsx` (+`sheetLoading`), `MyTimesheetPage.tsx`, `TimerCard.tsx` (cap at 1440 minutes)                                                                                                     | Tests in the matching files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BIL-01 invoice Submit, Approve, Reject and Issue-approved    | I T V (P)       | UI: `billing/pages/InvoiceDetailPage.tsx`                                                                                                                                                                        | Uses the existing hooks. Approve follows `invoice.can_approve`. Reject follows `invoice.approve` on `awaiting_approval` or `approved`, which matches the API exactly (`invoices.py` reject: "Any holder of `invoice.approve` may reject, including the person who submitted it"). **Tests:** `InvoiceApproval.test.tsx` (new, 11). **Partial:** the Invoices list row menu still has no Approve or Reject. The detail page is the only place to decide.                                              |
| BIL-05 Issue or Submit from the server's `approval_required` | I T V           | UI: `prepare/DetailsStep.tsx`, `test/prepare.ts`, `PrepareInvoicePage.test.tsx`                                                                                                                                  | `draft.approval_required` decides. Tests cover both directions.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| BIL-06 own WIP adjustment Approve                            | I T V           | UI: `wip/components/AdjustmentsView.tsx` (`requested_by.user_id`)                                                                                                                                                | Tests: `WipAdjustmentsPage.test.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| BIL-07 adjustment hint shows the percentage rule             | I T             | UI: `AdjustmentFormPanel.tsx`                                                                                                                                                                                    | Test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| BIL-09 billing and WIP invalidation                          | I T             | UI: `billing/api/invalidation.ts`, `wip/api/invalidation.ts`                                                                                                                                                     | New `invalidation.test.tsx` files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Wave 2: NOT implemented (stopped by instruction)

CLI-01, CLI-02, CLI-03, CLI-04 (UI part), CLI-08, SET-01, TEAM-01, PERM-01, PERM-02, PERM-03,
REP-02, REP-04a, REP-05, REP-06, EXP-01. These are still open, with the evidence recorded in
the audit.

### Earlier work in the same working tree (gap review and UI requests)

| Change                                                                                         | Status | Evidence                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Clients and Leads switch (`ClientsLeadsSwitch`), no Clients sidebar                            | I T V  | `ClientsLeadsSwitch.test.tsx`, `LeadsPage.test.tsx`; local app at 1280, 1366 and 1920                              |
| VAT Summary report                                                                             | I T V  | `vatSummary.test.tsx`; menu, loader and description                                                                |
| Lock Past Periods and Import/Export menu rules                                                 | I T V  | `orgRouting.test.tsx`                                                                                              |
| Expense Claims stays marked on a claim (`activePageId` honours `alsoActiveOn` for index pages) | I T V  | `Sidebar.test.tsx`                                                                                                 |
| Sidebar uses `Link` (no double `aria-current`); labels wrap                                    | I T V  | `Sidebar.test.tsx`; local check showed no cut labels                                                               |
| Settings menu duplicate keys                                                                   | I T V  | merged and live earlier (PR #21)                                                                                   |
| DataTable headings wrap (`whitespace-normal!`), padding `px-3 2xl:px-4`                        | I V    | Measured: 13 of 16 grids fit at 1366. Time Entries, Services and Staff were left as they are by the owner's choice |
| Grid column widths, 11 definitions                                                             | I V    | Measured with griddiag (local app)                                                                                 |
| Week grid day columns at 104px                                                                 | I V    | Measured                                                                                                           |
| FormPanel title offset (`scroll-mt-20`); clients `DialogActions` sticky Save                   | I V    | Local check: the title shows and Save is on screen at 1366                                                         |
| Working hours delete                                                                           | I T V  | `StaffDetailPage.hours.test.tsx`                                                                                   |
| Help lifecycles, `module-map.md`                                                               | I      | docs                                                                                                               |
| API `seed_leads` (local and staging only)                                                      | I T    | `tests/test_seed_leads.py` (6) ran during implementation; 12 sample leads in the **local** database only           |

## 3. Coverage matrix: what was reviewed

| Module            | Screens and routes (UI)                                                                                                                              | API routers                                                                               | Main tables                                                                                  | Workflows traced                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Time              | My Timesheet (week, day), Time Entries, Team Timesheets, person drawer, timer, copy entry and week, corrections, Timesheet Approvals                 | `time_entries`, `time_views`, `timers`, `timesheets`, `time_corrections`, `overtime`      | time_entries, timesheets, timers, time_entry_overtime, period_locks                          | record → submit → approve, recall, reopen; correction; overtime confirm and decide; locked periods |
| Dashboard         | Overview, My Actions, My Timesheet, Pending Approvals, Missing Timesheets, widgets                                                                   | `dashboard_pages`, `dashboard`                                                            | (read models)                                                                                | figures against reports                                                                            |
| Clients and Leads | Client List, Client 360 tabs, contacts, engagements, client rates, central link, Leads                                                               | `clients`, `contacts`, `client_services`, `client_rates`, `leads`, `central_*`            | clients, contacts, client_services, client_rates, leads                                      | create, edit, archive, delete, merge; lead → convert                                               |
| Jobs              | Job List, detail, tasks, budgets, engagement jobs                                                                                                    | `jobs`, `job_tasks`, `job_budgets`, `engagement_jobs`                                     | jobs, job_tasks                                                                              | status path; budgets; copy                                                                         |
| WIP               | Summary, Details, Ageing, Adjustments, Transfers, Write-offs, Historic                                                                               | `wip`, `wip_views`, `wip_adjustments`, `wip_reports`                                      | wip_allocations, wip_write_offs, wip_adjustments, wip_transfers                              | write-off and reverse; adjust and approve; transfer                                                |
| Billing           | Prepare, Invoices, Invoice detail, Credit notes, Payments, Estimates, Recurring, Statements, Debtors                                                 | `invoices`, `credit_notes`, `payments`, `estimates`, `recurring`, `statements`, `debtors` | invoices, invoice_lines, credit_notes, payments, allocations, estimates, recurring_schedules | draft → submit → approve or reject → issue → pay, credit, void                                     |
| Expenses          | My Expenses, Claims, Approvals, Receipts, Types, Disbursements                                                                                       | `expenses`, `expense_*`, `disbursements`                                                  | expense_claims, expenses, receipts, disbursements                                            | claim → submit → approve or return → recharge to WIP                                               |
| Reports           | All 16 report definitions, filters, drills, downloads                                                                                                | `reports`, `reports_ext`, `wip_reports`, `recovery`                                       | (aggregates)                                                                                 | filter → API parameter mapping; export gate                                                        |
| Team & Rates      | Staff, Grades, Cost and Charge-out rates, Rate history and preview, Re-rate, Overtime Rates, Activity types, Services                                | `members`, `staff`, `grades`, `rates`, `rerate`, `overtime_rates`, `staff_hours`          | organization_members, grades, rates, staff_hours_bases, overtime_rates                       | rate precedence; re-rate preview → apply                                                           |
| Settings          | General, Practice, Roles, Period locks, Branches, Segments, VAT, Numbering, Templates, Notifications, Integrations, Import/Export, Audit, Onboarding | the matching routers                                                                      | roles, role_permissions, vat_rates, sequences, …                                             | permission catalogue against `permissions.md`                                                      |
| Account, tickets  | Account, sessions, Application Testing                                                                                                               | `auth`, `users`, `tickets`                                                                | users, sessions, tickets                                                                     | password, sessions, ticket lifecycle                                                               |

**Not reviewed in depth:**

- Integrations' external flows (webhooks and mocks).
- Notifications delivery and the worker.
- Mobile layouts below 1280px.

## 4. Regression test evidence (executed during this verification)

### API

Each file ran in its own pytest process on the isolated database. Every one passed with
**0 failures**. Total: **455 tests**.

| Area                   | File (tests)                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice workflow       | test_invoices (26), test_invoices_lifecycle (8), test_invoice_void_delete (8), test_invoice_lines_save (4), test_credit_notes (8), test_payments (8), test_approval_switches (14), test_invoices_reconciliation (2) |
| Expense WIP            | test_expense_wip (9), test_wip (18), test_reports_wip (12), test_reports_v2_consistency (8)                                                                                                                         |
| Financial calculations | test_money_and_defaults (14)                                                                                                                                                                                        |
| Time-entry updates     | test_time_entries (24), test_timesheets (14), test_time_approval_exempt (7), test_period_lock_enforcement (15)                                                                                                      |
| Permissions            | test_permissions_doc (3), test_reports_access (46), test_member_permissions (13, exit 0)                                                                                                                            |
| CSV and exports        | test_reports_v2_exports (26), test_audit_export (34)                                                                                                                                                                |
| Dashboard and budgets  | test_dashboard (8), test_job_budgets (8)                                                                                                                                                                            |
| Organisation isolation | test_clients (55), test_client_overview (16), test_audit_list (26), test_audit_history (47)                                                                                                                         |

**Static checks:**

- `ruff check .`: all checks passed.
- `mypy app`: no issues in 459 files.
- `ruff format --check .`: 2 files flagged, `docs/database.md` and `docs/testing.md`. Both fail
  the same way on `origin/main` (checked), so this is **pre-existing**.

**Not run locally:** the full API suite (about 1,900 tests; it takes hours on this laptop). It
runs in CI on the PR. **A green CI is a release gate.**

### UI

The full suite run gave:

- **2,686 passed and 1 failed** (236 files).
- The failure was `InvoiceDraftLines.test.tsx`: "Test timed out in 30000ms" while the API tests
  ran at the same time.
- There were 2 unhandled runner errors ("Failed to start forks worker"), so
  `ServicesPage.test.tsx` and `EstimatesPage.test.tsx` did not run in that pass.

Rerun on their own, all 3 files passed: **75 of 75**. Classification: an infrastructure
timeout under load, not a defect. All UI tests pass.

Also clean:

- `tsc -b --noEmit` (exit 0).
- `eslint . --max-warnings 0` (exit 0).
- `npm run build` (built in 43s).

## 5. Organisation isolation and backend permissions

### Isolation

Every new or changed query is scoped to the organisation:

- REP-01 expense query: `Expense.organization_id ==`, joins on `organization_id`, and the claim
  subquery is scoped.
- BIL-02a: `lock_wip_items`, `lock_expenses(organization_id, …)`,
  `wip_expense_conditions(organization_id)`.
- TIME-05: `period_locks.locked_through(ctx.organization_id, …)`.
- CLI-04: the existing organisation-scoped totals.

The isolation tests ran and passed. Each asserts against another practice's data: clients (3
such assertions), client overview (4), audit list, history and export (1 each), WIP (2), report
access (4) and invoices (4).

### Backend permissions

- No route's permission dependency was loosened.
- REP-03 tightened one: the CSV now needs `report.export`.
- UI gating changes only hide actions the API refuses (TIME-04, TIME-05, BIL-06) or follow the
  API's own rule (BIL-01 `can_approve`, `invoice.approve`, `invoice.issue`).
- The UI gating stays cosmetic: the API checks everything again.

## 6. Regression analysis: effects on other modules

| #      | Effect                                                                                                                                                                                                                                                                                                                                                                  | Severity                  | Release impact                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| NEW-01 | **WIP & Ageing labels.** After REP-01, its **"Disbursements"** column and stat card also include expense recharges (`wipAgeing.tsx:62-68,139`), but the label still says "Disbursements". Found in this verification; not fixed, as instructed.                                                                                                                         | Medium (misleading label) | Fix the label ("Disbursements & expenses") or add an expense column before releasing REP-01. |
| NEW-02 | **WIP figures still disagree on two screens.** The Client overview WIP (`client_overview` via `WipRepository.summary_page`) still leaves out expense WIP. On fixed-fee jobs, the original WIP report counts time at its charge value where `GET /wip` counts the recognised fee, and it leaves out WIP adjustments. All of this predates our changes and is documented. | Medium                    | Not caused by this change set, but WIP still differs between screens in those two cases.     |
| R-1    | **Higher WIP figures.** Dashboard Unbilled WIP and Top clients by WIP will rise for practices with approved expense recharges: it's a correction. Users will see the figures change on deploy.                                                                                                                                                                          | Info                      | Mention it in the release note.                                                              |
| R-2    | **Grid layout.** DataTable header wrapping and padding change the look of all 70 grids (two-line headings, slightly tighter cells below 1536px).                                                                                                                                                                                                                        | Low                       | Visually checked on key grids only.                                                          |
| R-3    | **Expense write-off is new.** It is reversible, and written-off expense lines drop out of WIP.                                                                                                                                                                                                                                                                          | Low                       | Tested (write-off and reverse).                                                              |
| R-4    | **Deploy order.** The UI part of TIME-05 needs the API part to be useful, and degrades safely without it. BIL-01 and BIL-05 use `approval_required` and `can_approve`, which are already on main.                                                                                                                                                                       | Info                      | API first, then UI (the standard order).                                                     |

## 7. Partially implemented or thin coverage

- **CLI-04:** API only. The UI card is not updated.
- **TIME-02:** the button text before submit (needs an API flag).
- **BIL-01:** decisions only on the detail page; no list row Approve or Reject.
- **REP-01:** fixed-fee and adjustment differences (NEW-02), and the label (NEW-01).
- **Not exercised in a running app:** the invoice approval flow, the expense write-off and the
  week-grid task rows. They are covered by automated tests only. The local demo data has no
  pending invoices, expense WIP or tasked time.
- **Grid width:** budgets, claims, receipts, debtors and aged-debtors were measured on headings
  only (no local rows).
- **Full API suite:** not run locally (CI gate).

## 8. Status summary

- **Confirmed defects (audit):** 30 SAFE-FIX. Implemented: 18 fully, 3 partially (TIME-02,
  BIL-01, CLI-04), and 15 not started (wave 2).
- **New findings in verification:** NEW-01 and NEW-02 (documented, not fixed).
- **Remaining technical work:**
  - wave 2 (15 items);
  - the CLI-04 UI part;
  - NEW-01;
  - the BIL-01 list row actions;
  - the TIME-02 exemption flag;
  - a manual browser check of the invoice approval and expense write-off flows with seeded data.
- **Business decisions:** see the audit list (15) plus the gap-review list. None was decided or
  implemented.

## 9. Release readiness

**Release-blocking for this change set:**

1. **NEW-01:** fix the WIP & Ageing label before shipping REP-01, or hold REP-01.
2. **API full suite:** green CI on the API PR (not runnable locally).
3. **Manual check:** a check of invoice Submit, Approve, Reject and Issue, and of the expense
   write-off and reversal, in a local or staging app with data.

**Pre-existing defects that matter for the app but are not regressions** (they come from the
audit and are not fixed): CLI-01 (a closed job breaks the Client 360 Jobs tab, High), CLI-02,
CLI-03 and SET-01.

**Not blocking:** the wave-2 Low items, the grid cosmetics, and the documented decisions.
