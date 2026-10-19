# Work in Progress (UI)

The six WIP pages are built from `capiumtimenfeeapi/docs/modules/wip.md`, `billing.md` and
`domain.md` ("WIP"), and from the live API (the OpenAPI document alone was not enough, see "Things
the API does that the schema does not say"). Money is pence on the wire and pounds on screen; the
pages keep their names, default exports and routes from the placeholders.

## Pages and permissions

| Route (`wip/…`) | Page            | Reads with                   | Changes need                                                                                          |
| --------------- | --------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `` (index)      | WIP Summary     | `wip.read`                   | nothing to change                                                                                     |
| `details`       | WIP Details     | `wip.read`                   | write off `wip.write_off`, transfer `wip.transfer`                                                    |
| `ageing`        | WIP Ageing      | `wip.read`                   | nothing to change                                                                                     |
| `adjustments`   | WIP Adjustments | `wip.read`                   | adjust and reverse `wip.adjust`, approve or reject `wip.approve`, reverse a write-off `wip.write_off` |
| `transfers`     | WIP Transfers   | `wip.read`                   | transfer and reverse `wip.transfer`                                                                   |
| `historic`      | Historic WIP    | `report.financial` (the API) | download `report.export`                                                                              |

The navigation opens Historic WIP with `wip.read`; the page shows a "no access" state when the
person lacks `report.financial`. Nobody approves their own request (403 `SELF_APPROVAL_FORBIDDEN`)
unless they hold `organization.update`: the dialog shows the refusal and keeps what was typed.

## Endpoints

- Summary and Ageing share `SummaryView`: `GET /wip/summary` (group by client, job, partner,
  manager or service; the totals come with the first page).
- Details: `GET /wip/items`; selected items go to `POST /wip/write-offs` or `POST /wip/transfers`.
- Adjustments page, three views chosen with `?view=`:
  - `adjustments` (default): `GET /wip/adjustments` and `/counts`, `POST /wip/adjustments` and
    `…/{id}/approve|reject|reverse`. Above the practice's limit an adjustment waits for approval.
  - `write-offs`: `GET /wip/write-offs`, `DELETE /wip/write-offs/{id}` (reverse, 409
    `WRITE_OFF_BILLED` once an item has been billed).
  - `ledger`: `GET /wip/ledger`, read only (the ledger is append-only; a correction is a reversal).
- Transfers: `GET /wip/transfers`, `POST /wip/transfers`, `POST …/{id}/reverse`.
- Historic: `GET /reports/wip?group_by=client|job|billing_type` (JSON for the page, `csv` or `xlsx`
  for the download) and `GET /reports/wip/items` for the rows behind a figure.

## Things the API does that the schema does not say

- **An item write-off is not a ledger movement.** `POST /wip/write-offs` writes a `wip_write_offs`
  row and allocations, never a `wip_movements` row, so `GET /wip/ledger?source_type=write_off` is
  always empty. The write-offs have their own list and their own reversal (the Write-offs view); the
  ledger holds adjustments, transfers and credit notes only.
- **The ageing key is `days_90_plus`** in `/wip/summary` and `/reports/wip` (the OpenAPI dump showed
  `days_91_plus` because two schemas share a class name; the legacy `GET /wip` does use
  `days_91_plus`).
- **A past day is frozen the first time it is read** (`wip_snapshots`, append-only by trigger:
  nothing can undo it). So Historic WIP opens on today, which is computed live, and a past day is
  chosen on purpose (the "Last month end" button is there for the usual one). Probing a past day
  against a shared database freezes it with whatever it holds at that moment.
- `GET /reports/wip/items` used to refuse `limit` and `cursor` (422 `extra_forbidden`: a strict
  query model and a separate page dependency); the API now takes both on the model, and the drill-down
  dialog pages with "Load more".
- A practice that requires timesheet approval shows unapproved time nowhere in the WIP; disbursements
  do show.

## Folder

`src/features/wip/` (all new files): `types.ts`, `constants.ts`, `api/` (typed calls, hooks,
`wipKeys` under `queryKeys.org.wip` so the time, expense and team features refresh them),
`schemas/wip.ts` (zod), `utils/`, `hooks/` (`useUrlSearch`, `useWipFilters`), `components/`, `pages/`
and the test kit `test/{fixtures,handlers,render,Where}`: an in-memory fake of every endpoint above
that follows the API's rules (threshold, self-approval, 409 codes) and records each request
(`createBackend` + `wipHandlers` + `callsOf`).

The feature imports other features only through their `index.ts` (team: `ClientPicker`,
`JobPicker`). The small shared pieces (`PageShell`, `FilterPopover`, `DialogActions`, `useUrlSearch`,
error mapping) are per-feature copies, as in Jobs.

## Tests and live checks

`npx vitest run src/features/wip` (101 tests). A live check against the dev stack covered the six
pages, a write-off and its reversal, a pending adjustment and its rejection, the historic report for
today with its drill-down and the CSV download. Approvals and transfers were not exercised live: they
write append-only ledger rows.
