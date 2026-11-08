# TimeFee audit fixes: final verification and safe Git publication plan (8 Nov 2026)

For review. **Nothing has been committed, pushed, merged or deployed.** The goal is to run the
full API suite in GitHub CI without touching existing branch history or production.

## 1. Final verification results

### API

All runs used the local isolated test databases (`capium_test_seedleads`, `capium_test_bil01`),
each file in its own pytest process.

| Run                      | Files                                                                                                                                                                                                                                                | Passed | Failed | Skipped | Errors |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ------- | ------ |
| Verification run (7 Nov) | 28 files: invoices, credit notes, payments, approval, money, expense WIP, WIP, reports, CSV and audit exports, time, timesheets, period locks, permissions, dashboard, budgets, isolation                                                            | 455    | 0      | 0       | 0      |
| Phase 1 run (8 Nov)      | test_invoices (27), test_invoices_lifecycle (8), test_approval_switches (14), test_invoices_bulk (4), test_timesheets (14), test_time_approval_exempt (8), test_time_gaps_openapi (4), test_errors (11), test_job_budgets (8), test_reports_wip (12) | 110    | 0      | 0       | 0      |

The verification run's files are listed in `TIMEFEE-AUDIT-VERIFICATION.md` §4.

**Static checks:**

- `ruff check .`: all checks passed.
- `mypy app`: no issues in 459 files.
- `ruff format --check .`: 2 files would be reformatted, `docs/database.md` and
  `docs/testing.md`. Both are **pre-existing**: they fail the same way on `origin/main`.

**Not run locally:** the full API suite (about 1,900 tests). That is the purpose of the CI run
below.

### UI

- **Tests:**
  - The full suite passed 2,686 of 2,687. Its one timeout and the two files that failed to start
    passed when rerun on their own (75 of 75).
  - The Phase 1 folders (billing, jobs, reports, time) passed 608 of 608.
  - The new list approval tests passed 5 of 5.
- **Static checks:** `tsc -b --noEmit` exits 0, `eslint --max-warnings 0` exits 0, the CRLF-safe
  Prettier check is clean on all changed files, and `npm run build` succeeds.

### Running app

Checked locally on `capium_run_main` with local test data created through the API (scratchpad
scripts, not in any repo):

- **Invoice A:** Submit → Approve → Issue (INV-00001). History: submitted, approved.
- **Invoice B:** Submit → Reject from the list (reason required) → Submit → Approve from the list.
  History: submitted, rejected, submitted, approved.
- **Expense line (£60, with receipt):** write-off from WIP Details, recorded as one `expense`
  item of 6,000. The WIP report total fell by £60; after reversal (`DELETE
/wip/write-offs/{id}`) "Disbursements & expenses" rose by exactly 6,000.
- **Label:** WIP & Ageing shows "Disbursements & expenses".
- **Note:** the walkthrough ran as the Owner, and the Owner is the only user who may approve an
  invoice they prepared or submitted. A separate approver user was not set up locally (it needs
  an e-mailed invite). The other-approver and self-submitter rules are covered by the automated
  tests.

## 2. Diff review (both repositories, against `origin/main`, including new files)

- **Credentials:** none. I scanned for passwords, secrets, API keys, tokens, connection strings
  with credentials, the production host and the local demo password.
- **Generated files:** none (`__pycache__`, `.pyc`, `dist/`, `node_modules`, logs, images,
  `.env`, coverage).
- **Test data:** only fictional fixtures in tests and the `seed_leads` sample list
  (`example.com` and `example.co.uk` addresses). The local walkthrough data lives only in the
  local database, and its scripts are outside the repositories.
- **Unrelated changes:** none found. Every changed file maps to a gap-review, audit or Phase 1
  item.
- **Untouched:** the main API checkout's untracked `AP_DevSecOps_Implementation_Plan.pdf` and
  `docs/devsecops/` are not ours. They are outside these branches and left alone.

## 3. Business-rule check

**Expense WIP and write-off**
(`docs/modules/expenses.md:549,554`; `domain.md` WIP permissions):

- A line counts only when:
  - its claim is approved;
  - it is billable;
  - it has a client;
  - it is unbilled;
  - its recharge is above 0.
- A write-off sets `written_off`; a reversal sets `unbilled` again.
- The existing period-lock check (`assert_open`) and the `wip.written_off` audit row apply to
  expense lines too. The permission is still `wip.write_off`.
- Verified in code, tests and the running app.

**Invoice approval** (`domain.md:89-91`; API `billing.md` "Segregation";
`services/invoices.py` `_can_approve`):

- Approve follows the API's `can_approve`. Whoever created the draft or last submitted it
  cannot approve it (409 `SELF_APPROVAL_NOT_ALLOWED`); only the **Owner** is exempt. Holding
  `organization.update` alone (for example an Admin or Partner) does **not** grant the
  exception. Earlier wording here, and the BIL-01 commit message (`eee88ed`), said
  "unless `organization.update`"; that was wrong, and the code was always Owner-only.
- Reject is for holders of `invoice.approve` on `awaiting_approval` or `approved` invoices,
  matching the API route description.
- Issue on `approved` needs `invoice.issue`.
- The threshold comparison (`>=` in code, "above" in the doc, BIL-08) is unchanged and remains a
  business decision.

## 4. Branch history: why `jaasir` would need a force-push

| Repo | origin/main | origin/jaasir | local jaasir                  | Is origin/jaasir an ancestor of local? | Commits only on origin/jaasir        |
| ---- | ----------- | ------------- | ----------------------------- | -------------------------------------- | ------------------------------------ |
| UI   | `a2dd183`   | `d8865e7`     | `8e1b7de` (1 commit on main)  | **No**                                 | 1 (`d8865e7`, the Settings menu fix) |
| API  | `7141e65`   | `c7b6d50`     | `3fd855c` (3 commits on main) | **No**                                 | 7 (APT49, APT50, APT51 and fixups)   |

- **Why they diverge:** PRs are **rebase-merged**, which rewrites commit ids. The remote `jaasir`
  keeps the pre-merge copies, so local `jaasir` (rebuilt on the new `main`) has diverged from it,
  and pushing to `jaasir` would need a force-push.
- **Nothing would be lost:** `git cherry origin/main origin/jaasir` marks every one of those
  remote-only commits as already in `main`.
- **No open PRs** use `jaasir` in either repo.

## 5. Can a normal push be used instead? Yes: a new branch

API CI runs on `pull_request` (any branch) and on pushes to `main` (`.github/workflows/ci.yml`).
**Any PR runs the full suite, whatever its branch is called.** The UI repo has no CI workflow.

### Recommended (API, to run CI): new branch, normal push, draft PR

No history is rewritten.

1. **Commit** the 27 uncommitted API changes on local `jaasir` as reviewable commits (below).
   This needs your approval to commit.
2. **Branch:** `git branch jaasir-ci-20261108 jaasir`. This creates a label; nothing is moved or
   rewritten.
3. **Push:** `git push -u origin jaasir-ci-20261108`. This is a normal push of a **new** remote
   branch, so it cannot overwrite anything, and it is not a force-push.
4. **PR:** `gh pr create --draft --base main --head jaasir-ci-20261108`, with the body in §6 and
   a title marked "CI run — do not merge". CI starts.
5. **Watch:** `gh pr checks <n>`. Report the exact result. **No merge, no deploy.**

**What stays unchanged:** remote `jaasir` (and its pre-merge copies), local `jaasir`, every local
commit, `main` and production.

**After review:** either merge this PR (normal rebase merge, with your approval) or close it.
Deleting the temporary branch needs your approval.

### Alternative: reuse `jaasir` (single-branch preference)

`git push --force-with-lease=jaasir:<remote sha> origin jaasir`

- It refuses if the remote moved since it was checked, and every commit it replaces is already in
  `main` (§4).
- It does rewrite the remote branch history, so it is held until you explicitly approve it.

### Proposed API commits (each reviewable on its own)

1. `TimeFee audit REP-01/REP-03: expense WIP in the WIP report and dashboard; WIP CSV needs report.export`
   - `repositories/reports.py`
   - `api/v1/wip_reports.py`
   - `schemas/reports.py`, `schemas/dashboard_pages.py`
   - `docs/modules/dashboard.md`, `docs/modules/reports.md`
   - tests: reports_wip, reports_v2_consistency, reports_v2_exports, dashboard
2. `TimeFee audit BIL-02a: expense WIP can be written off and reversed`
   - `services/wip.py`, `api/v1/wip.py`
   - `docs/modules/billing.md`
   - test_wip
3. `TimeFee audit TIME-05/TIME-02: timesheet detail gives locked dates and approval_exempt`
   - `services/timesheets.py`, `schemas/time.py`
   - test_period_lock_enforcement, test_time_approval_exempt
4. `TimeFee audit CLI-04: budget totals give the basis of their percentages`
   - `schemas/job_budgets.py`
   - test_job_budgets
5. `TimeFee audit BIL-01: invoice list says whether the caller may approve`
   - `schemas/invoices.py`, `repositories/invoices.py`, `services/invoices.py`
   - test_invoices
6. `TimeFee audit docs: job rate precedence, task status POST, clients list and delete rules`
   - `schemas/jobs.py`
   - `docs/modules/time.md`, `docs/modules/clients.md`

Before step 1, I will confirm with `git diff` that each file falls into exactly one commit. A
file that carries two items (for example `schemas/time.py`) goes in with the item it was changed
for.

### UI (no CI)

The same choice applies when you want a UI PR:

- **Commits:** the 75 modified and 16 new files, grouped into gap-review navigation, grids and
  forms, audit wave 1, Phase 1, and docs.
- **Branch:** a new branch with a normal push (recommended), or a force-with-lease on `jaasir`.

The UI should be merged only after the API.

## 6. PR-ready summaries

Drafted in the session scratchpad (`verify/PR-API.md`, `verify/PR-UI.md`). They list every fix,
the root causes, the tests and the deploy order (API first).

## 7. Current Git status

| Repo                           | Branch   | HEAD      | Local commits (not pushed) | Uncommitted         |
| ------------------------------ | -------- | --------- | -------------------------- | ------------------- |
| UI `capiumtimenfeeui`          | `jaasir` | `8e1b7de` | 1                          | 75 modified, 16 new |
| API `capiumtimenfeeapi-jaasir` | `jaasir` | `3fd855c` | 3                          | 27 modified         |

Both are up to date with `origin/main` (0 behind).

## 8. Waiting for your decision

1. **Commit approval:** the API commits in §5. The UI commits can come later.
2. **Publication method:**
   - **(A) recommended:** new branch `jaasir-ci-20261108`, normal push, draft PR, CI only;
   - **(B):** force-with-lease on `jaasir`.
3. **Phase 3:** held until the CI result is known.
