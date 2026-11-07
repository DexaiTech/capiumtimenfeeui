# TimeFee: complete application audit (7 Nov 2026)

A full UI ↔ API ↔ database review of every module. It follows on from
`TIMEFEE-APPLICATION-GAP-REVIEW.md`, which covered menus, navigation, leads and grid widths.
Code read: UI working tree (`jaasir` + local fixes), API `jaasir` (latest main + seed command).
Five read-only audits ran in parallel, one per area, and every finding was confirmed in code on
both sides. The three most serious ones were re-checked by hand (BIL-01, CLI-01, REP-01).

## Architecture in one paragraph

- **UI:** React/TS with TanStack Query. A data-driven menu (`src/constants/navigation.ts`, which
  is also the route guard). Feature folders hold the `api/` hooks, which invalidate by query
  key.
- **API:** FastAPI routers → services (rules, one transaction, an audit row) → repositories
  (scoped to the organisation) → PostgreSQL.
- **Units:** money is integer pence; VAT and percentages are basis points.
- **Permissions:** checked by `require(...)` on every API route. The UI gating is cosmetic.

## Modules reviewed

- **Time:** entries, week grid, timer, copy, corrections, timesheets, approvals, overtime,
  reminders.
- **Dashboard.**
- **Clients:** list, Client 360 tabs, contacts, engagements, client rates, central linking.
- **Leads.**
- **Jobs:** list, detail, tasks, budgets, engagement jobs.
- **WIP:** summary, details, ageing, adjustments, transfers, write-offs, historic.
- **Billing:** prepare, invoices, approval, issue, void, credit notes, payments and allocations,
  estimates, recurring, statements, debtors and reminders.
- **Expenses:** claims, lines, receipts, approvals, mileage, disbursements.
- **Reports:** all of them, with their filters, drills and downloads.
- **Team & Rates.**
- **Settings:** all pages.
- **Account and Application Testing tickets.**
- **Permissions across every module.**

**Found consistent:**

- Report filter and parameter names.
- Money and VAT maths (BigInt, half away from zero).
- Allocation rules.
- Expense amount rules.
- Validation limits on clients, contacts, engagements, team and settings.
- Permissions for every system role.
- Confirmation dialogs on destructive actions.

## Confirmed issues: fixed (SAFE-FIX)

| ID                         | Sev     | Issue                                                                                                                                                          | Fix                                                                     |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| BIL-01                     | High    | No screen can approve, reject or submit an invoice, or issue an approved one: a submitted invoice is stuck                                                     | Invoice detail actions using the existing hooks                         |
| BIL-02a                    | High    | Expense WIP cannot be written off: the API drops `expense_id`s, then answers a misleading 422                                                                  | API write-off passes the expense ids                                    |
| REP-01                     | High    | The WIP & Ageing report, the dashboard Unbilled WIP card and Top clients by WIP leave out approved expense WIP, which the WIP screen and `expenses.md` include | Add expense lines to the report's `wip_items`                           |
| CLI-01                     | High    | Client 360 Jobs tab: no `closed` status (a closed job breaks the row), and `cancelled` labelled "Closed"                                                       | Use the jobs feature's status list                                      |
| CLI-02                     | Med     | The Internal client is offered edit, archive, link, services and new invoice, which the API always refuses                                                     | Read `is_internal` and turn those off                                   |
| CLI-03                     | Med     | New job, Add time, expenses and Create job now are offered on inactive or archived clients (API 409)                                                           | One "accepts work" check                                                |
| CLI-04                     | Med     | Budget Tracking "Hours logged" and its % use different job sets                                                                                                | The API exposes the basis totals; the card uses them                    |
| TIME-01                    | High*   | Week grid rows that differ only by task share a key, so a cell save can update the wrong entry (*only where tasked time exists)                                | Add `task_id` to the row key                                            |
| TIME-02                    | Med     | An exempt person's submit says "your manager can approve it" and offers an Undo that fails                                                                     | Use the status the submit returns                                       |
| TIME-04                    | Med     | Correction, Revoke and Remove are offered on your own time, and the API refuses them                                                                           | Apply the self rule (unless `organization.update`)                      |
| TIME-05                    | Low     | Time in a locked period looks correctable or removable                                                                                                         | Hide the action; the API fills `locked_through` in the timesheet detail |
| SET-01                     | Med     | The audit log Export is built but never shown                                                                                                                  | Show it with `audit_log.export`                                         |
| TEAM-01                    | Low-Med | "Edit permissions" on your own staff record always fails                                                                                                       | Hide it on yourself                                                     |
| BIL-05                     | Low-Med | Create Invoice picks Issue or Submit from an estimated total                                                                                                   | Use `draft.approval_required`                                           |
| BIL-06                     | Low     | Approve is shown on your own WIP adjustment (API 403)                                                                                                          | Self rule                                                               |
| BIL-07                     | Low     | The adjustment approval hint leaves out the percentage rule                                                                                                    | Hint text                                                               |
| REP-02                     | Med     | The WIP & Ageing note says past dates are frozen; the screen is live                                                                                           | Correct the note                                                        |
| REP-03                     | Med     | WIP CSV download skips the `report.export` check and its audit row                                                                                             | Gate and audit it, with a test                                          |
| REP-05                     | Low     | The Expenses report subtitle says it includes disbursements                                                                                                    | Copy                                                                    |
| REP-06                     | Low     | Billing and Aged-debtors drills drop the client filter and as-at date                                                                                          | Pass them                                                               |
| REP-04a                    | Low     | The Expenses report job drill loses the job                                                                                                                    | Pass and read `job_id`                                                  |
| EXP-01                     | Low-Med | Submit (when it auto-approves), return, recall and disbursement changes leave the WIP, dashboard and reports stale                                             | Wider invalidation                                                      |
| TIME-06/07, BIL-09, CLI-08 | Low     | Stale timer, reminders, time/jobs after billing, timer after job delete                                                                                        | Missing invalidations                                                   |
| TIME-08, TIME-09           | Low     | The no-rate warning is skipped while loading; the timer estimate is not capped at 24h                                                                          | Small guards                                                            |
| PERM-01, PERM-02, PERM-03  | Low     | Custom roles only: Integrations, Onboarding and Staff bulk actions gated on the wrong permission                                                               | Use the API's rule                                                      |
| CLI-09, CLI-13, CLI-14     | Low     | Doc and description drift                                                                                                                                      | Docs                                                                    |

## Needs a business decision (not changed)

| ID       | Question                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| TIME-03  | Where should pending overtime be decided once its week is approved? Should approving a sheet with pending overtime warn or block? |
| BIL-02b  | Should expense recharges be invoiceable now? (`WipSelection` has no `expense_ids`.)                                               |
| BIL-03   | Credit notes: credit each line at the invoice line's stored VAT rate? This needs an API contract change (`invoice_line_id`).      |
| BIL-04   | Full credit with discount lines or more than 100 lines: one line per VAT rate?                                                    |
| BIL-08   | An invoice exactly at the approval threshold: approved or not? (Code says `>=`, domain.md says "above".)                          |
| REP-04b  | Expenses report drill by type or status, and for own-scope users: which page should it open?                                      |
| EXP-02   | Should a manager's recharge override survive a change to the net amount?                                                          |
| CLI-05   | Does "WIP" on job screens mean unbilled time, or WIP by the domain rules?                                                         |
| CLI-06   | Copying a job to another client: keep or clear its agreed rate?                                                                   |
| CLI-07   | Merged-away clients: refuse writes in the API, or only in the UI?                                                                 |
| CLI-10   | Client History tab: `client.read` or `audit_log.read`?                                                                            |
| CLI-11   | Which row actions should the Clients list and Client 360 share?                                                                   |
| CLI-12   | May an unfinished job be closed directly? (The doc is stricter than the code.)                                                    |
| TIME-10  | Delete the stray `TeamTimesheetsPage.tsx.new`? (File deletion needs approval.)                                                    |
| PERM-02b | Should read-only roles see the onboarding checklist?                                                                              |

Earlier open decisions (gap review): the missing phase, Client Overview placement, the Settings
Practice headings, live sample leads, the lead pipeline, ticket tags, task reorder, PM unlink,
and the subscription banner.

**Intended (no change):** the dashboard "Billed" card is before credit notes (REP-07,
documented).

## Implementation and testing

## Results

Implementation results, tests and the independent verification are in
[TIMEFEE-AUDIT-VERIFICATION.md](TIMEFEE-AUDIT-VERIFICATION.md): the status of each fix, the
coverage matrix, the test evidence, organisation isolation, regressions and release readiness.
In short, wave 1 is implemented and verified, and wave 2 is not started (stopped on
instruction).
