# Team & Rates (UI)

The Team & Rates module (`/:orgSlug/team/*`, menu 9) is built from
`capiumtimenfeeapi/docs/modules/team-rates.md`. Money is pence (rates are pence per hour),
percentages are basis points, dates are `YYYY-MM-DD` shown as `dd/MM/yyyy`. Nothing here
changes the API.

## Pages and permissions

| Route (`team/…`)   | Page             | Needs (page)  | Actions need                                      |
| ------------------ | ---------------- | ------------- | ------------------------------------------------- |
| `staff`            | Staff Members    | `member.read` | `member.invite`, `member.update`, `member.remove` |
| `grades`           | Grades           | `member.read` | `rate.manage`                                     |
| `cost-rates`       | Cost Rates       | `rate.read`   | `rate.manage`                                     |
| `charge-out-rates` | Charge-out Rates | `rate.read`   | `rate.manage`                                     |
| `services`         | Services         | any member    | `settings.manage`                                 |
| `activity-types`   | Activity Types   | any member    | `settings.manage`                                 |
| `rate-history`     | Rate History     | `rate.read`   | none                                              |
| `rate-preview`     | Rate Preview     | `rate.read`   | none (asks, never writes)                         |
| `re-rate`          | Re-rate Time     | `rate.manage` | `rate.manage`; the earlier runs need `rate.read`  |

The page rules are the ones already in `constants/navigation.ts`. A page opened without its
permission shows an explanation instead of the list (and asks nothing of the API). Pickers read
staff (`member.read`), clients (`client.read`) and jobs (`job.read`); each is left out when the
person lacks that permission (the rate form and Rate Preview also say what is missing).

## Folder

`src/features/team/`: `api/` (typed calls, TanStack hooks, `teamKeys`, invalidation),
`schemas/` (zod), `utils/` (formatting, API error helpers), `components/` (pickers, staff, grades,
rates, catalogue, rerate dialogs and tables), `pages/` (one file per route, default export),
`test/` (fixtures and MSW handlers). `index.ts` is the surface other features may use: the
staff, client and job pickers, the catalogue hooks and the main types.

The staff list moved here from Settings (`settings/staff` redirects to `team/staff`). The V1
`members` query keys are still refreshed by every staff change, because Clients reads them.

## Behaviour worth knowing

- **Staff** — one `GET /staff` list (server filters and sort, cursor "Load more"). A person has no
  login by default; "Add staff member" can also invite them or create an account (the temporary
  password is shown once and never cached). Status changes use the lifecycle endpoints
  (`deactivate`, `reactivate`), so editing a person's status is an action, not a form field. An
  approver must be a person who can sign in.
- **Grades** — Delete removes an unused grade and deactivates a used one; the confirmation says
  which will happen first. The cost default is only offered with `rate.read`.
- **Cost and charge-out rates** — one list component for both kinds. Filters (level, date,
  staff, grade, client, service) and tabs (status) live in the URL. A rate that time has been
  recorded under (`is_used`) can be end-dated and its amount changed, never deleted or moved.
  `RATE_OVERLAP` lists the rates in the way on the form. "View history" opens Rate History
  narrowed to the rate's scope (`kind`, `staff`, `grade`, `client`, `service`).
- **Services and activity types** — bounded lists, so search, tabs and sorting happen on the
  client. A service saves in two calls (the service, then its activity types); if only the
  second fails the person is told the service was saved.
- **Rate Preview** — `GET /rates/resolve`. The question is in the URL, so an answer can be shared.
  Both ladders are shown: each level is Applied, Overridden, No rate set or Not applicable (with
  the reason).
- **Re-rate Time** — scope form, then a preview (nothing changes), then an apply behind a
  confirmation. Any change to the scope discards the preview, because the apply must send the
  scope and token of the preview. `PREVIEW_STALE`, `PREVIEW_MISMATCH` and `PREVIEW_REQUIRED`
  close the way back: the dialog explains and the person previews again. Applied runs are listed
  below with the entries each one changed or left alone.

## Tests

Each page has a test file with the loading, list, empty, error, permission and main-flow cases
(exact request bodies, validation, destructive confirmations). The shared fixtures and read
handlers are in `test/fixtures.ts` and `test/handlers.ts`. jsdom matches no media query, so the
UI kit's `Table` renders its card layout there; tests of pages that use it (the rate ladders, the
re-rate history) switch to the table layout with a small `matchMedia` stand-in.
