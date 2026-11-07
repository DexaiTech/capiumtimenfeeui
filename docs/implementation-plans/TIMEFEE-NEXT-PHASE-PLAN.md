# TimeFee: next implementation phase (plan, 7 Nov 2026)

Follows `TIMEFEE-AUDIT-VERIFICATION.md`. Each batch below is small and can be reviewed on its
own. Every batch:

- investigates the root cause first;
- adds regression tests;
- runs the relevant tests;
- keeps all existing uncommitted work and local commits;
- touches no production data, and pushes, merges and deploys nothing without approval.

API tests run on their own isolated local test database per batch, so parallel batches never
share one.

## Phase 1: complete the partial fixes (implement now)

| Batch | Item                                       | Root cause                                                                                                                                                                                            | Change                                                                                                                                                                                                                | Repos and files                                                                                                                       | Depends on                                   |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1A    | **CLI-04** Budget Tracking UI              | The totals card divides `logged_minutes` (every job) by the hours budget, and `time_value` (every job) by the fee budget. The API's percentages use only the jobs with that kind of budget.           | Card headline uses the API's `minutes_basis_logged` and `fee_basis_value` (added in the verified API change).                                                                                                         | UI `features/jobs/pages/BudgetTrackingPage.tsx`, jobs types, tests                                                                    | API CLI-04 (already in the API working tree) |
| 1A    | **NEW-01** WIP & Ageing label              | Since REP-01, `disbursement_value` also carries expense recharges. The column and stat card still say "Disbursements".                                                                                | Label "Disbursements & expenses" (column, stat card, CSV unchanged), and the note says expenses are included.                                                                                                         | UI `features/reports/definitions/wipAgeing.tsx`, tests                                                                                | API REP-01                                   |
| 1B    | **BIL-01** approval from the Invoices list | The list row menu offers Submit and Issue but not Approve or Reject, so decisions are only possible on the detail page.                                                                               | Row menu: Approve when the invoice can be approved by this user, and Reject with a reason (same rule as the detail page and the API). If the list item lacks `can_approve`, add it to the API list schema (additive). | UI `features/billing/pages/InvoicesPage.tsx` (+ tests); API invoice list schema and service only if `can_approve` is missing          | —                                            |
| 1C    | **TIME-02** exempt submit wording          | The UI cannot know before submitting that a person's week is approved at once. The timesheet has `approval_exempt` internally (`services/timesheets.py:141`), but the read schema does not expose it. | API: add `approval_exempt: bool` to the timesheet detail (additive, described). UI: button and confirm text say the week will be approved at once when exempt.                                                        | API `schemas/time*.py`, `services/timesheets.py`, tests; UI `features/time/components/timesheet/TimesheetStatusBar.tsx`, types, tests | —                                            |

## Phase 2: release blockers

1. **NEW-01:** batch 1A.
2. **Full API suite on GitHub Actions:** this requires pushing the `jaasir` branch, which needs a
   force-push because the remote branch holds pre-rebase commits, and opening a PR.
   **It needs your explicit approval before anything is pushed.** Nothing is merged or deployed.
3. **Isolated test dataset for manual verification:**
   - **Where:** the LOCAL database `capium_run_main` only.
   - **How:** a scratchpad script that goes through the local API. No repository file is added
     and production is not touched.
   - **What it creates:**
     - a client and job with approved billable time;
     - an approved expense claim with a recharge;
     - the practice's invoice-approval switch on, with a low threshold;
     - a second user (Manager) to submit and approve.
   - **Then, in the running local app:**
     - invoice Submit → Approve → Issue, and Submit → Reject;
     - expense WIP write-off → reverse;
     - the WIP & Ageing report and the dashboard include the expense.

## Phase 3: live-site defects (investigate and plan; implement after the plan is reviewed)

| ID            | Root cause (from the audit, re-checked)                                                                                                                                       | Planned fix                                                                                                     | Tests                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| CLI-01 (High) | The Client 360 Jobs tab keeps its own job status list without `closed`, so a closed job reads `.tone` of undefined. `cancelled` is labelled "Closed".                         | Use the jobs feature's status list and labels (`features/jobs/constants.ts`) in `clients/workspace`.            | A closed and a cancelled job render on the Jobs tab; the status filter offers both. |
| CLI-02 (Med)  | The UI `ClientRead` lacks `is_internal`, so edit, archive, link, services and "New invoice" are offered on the Internal client. The API always answers 409 `CLIENT_INTERNAL`. | Add `is_internal` to the types. `workspace/abilities.ts` turns those off; `ClientHeader` hides New invoice.     | Internal client: the actions are hidden. A normal client is unchanged.              |
| CLI-03 (Med)  | No shared "accepts work" check: New job, Add time, expenses and Create job now are offered on inactive or archived clients (API 409 `CLIENT_INACTIVE`).                       | One helper (`prospect`/`active` accept work) in `workspace/abilities.ts`, used by the header and the four tabs. | Each tab hides its action for inactive and archived clients.                        |
| SET-01 (Med)  | `AuditExportMenu` was built and never rendered.                                                                                                                               | Render it in the audit log list for `audit_log.export`, with the list's filters.                                | The button shows only with the permission, and the export call carries the filters. |

Dependencies: none between them; all four are UI-only. CLI-02 and CLI-03 share
`workspace/abilities.ts`, so they go in one batch.

## Phase 4: remaining audit fixes, prioritised

| Priority | ID                        | Sev     | Business impact                                                | Risk                            | Batch                                                  |
| -------- | ------------------------- | ------- | -------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| 1        | EXP-01                    | Low-Med | Stale WIP and dashboard after expense submit, return or recall | Low (invalidation)              | 4A expenses                                            |
| 2        | TEAM-01                   | Low-Med | Admin's own "Edit permissions" always fails                    | Low                             | 4B team                                                |
| 3        | REP-02                    | Med     | The WIP & Ageing note promises frozen history it doesn't do    | Low (copy)                      | 4C reports                                             |
| 4        | REP-06                    | Low     | Drills lose the client filter and as-at date                   | Low                             | 4C reports                                             |
| 5        | REP-04a                   | Low     | The Expenses job drill loses the job                           | Low                             | 4C reports (+ the expenses claims page reads `job_id`) |
| 6        | REP-05                    | Low     | Subtitle copy                                                  | Very low                        | 4C reports                                             |
| 7        | CLI-08                    | Low     | Stale timer after job delete                                   | Low                             | 4D jobs                                                |
| 8        | PERM-01, PERM-02, PERM-03 | Low     | Custom roles only                                              | Low; system roles are unchanged | 4E settings and team                                   |

- **Not included,** because they need a decision: PERM-02b (should read-only roles see
  onboarding?) and the 15 audit decisions plus the gap-review decisions.
- **Order:** 4A to 4E are independent and each ships as its own reviewable batch.

## Release readiness after this phase

- **This change set can be released once:**
  - Phase 1 and NEW-01 are done and tested;
  - the API CI is green (after the approved push);
  - the manual checks in Phase 2.3 pass.
- **Phases 3 and 4** follow as their own batches after review.
