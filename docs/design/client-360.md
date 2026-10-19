# Client 360 (UI)

The client workspace, the Client 360 landing page, the central clients dialog and the reusable
`ClientPicker`, built from `capiumtimenfeeapi/docs/modules/clients.md` ("Client 360") and
`central-clients.md`. No permission was added and nothing here changes the API.

## Routes

| Path below `/:orgSlug`                                                                                                  | Page                                  | Gate                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------- |
| `clients`                                                                                                               | Client list (`ClientsPage`)           | `client.read`                             |
| `clients/360`                                                                                                           | Client 360 landing (`Client360Page`)  | `client.read`                             |
| `clients/:clientId`                                                                                                     | redirects to `overview`               | `client.read`                             |
| `clients/:clientId/overview` · `jobs` · `time` · `expenses` · `wip` · `invoices` · `payments` · `contacts` · `settings` | Client workspace (`ClientDetailPage`) | `client.read`, plus the tab's own (below) |

The tab is the last URL segment, so every tab can be bookmarked and shared. A missing, unknown or
not permitted tab (`/clients/:id`, `/clients/:id/nonsense`, `/invoices` without `invoice.read`)
replaces the URL with `overview`. A tab's search, filters and sort live in its query string
(`?q=`, `status`, `from`, `to`, `sort`, `order`, `view`, `job`, `method`, `state`) and are dropped
when another tab is chosen.

## Structure

```
features/clients/
  pages/ClientDetailPage.tsx   fetches the client and its overview; header, tabs, the open tab
  pages/Client360Page.tsx      landing: search, recently viewed, "Find a client in Capium central"
  workspace/                   header (ClientHeader), tabs (ClientTabs), abilities, constants
    overview/                  key figures, WIP ageing, activity, the detail panels
    records/                   RecordTable, SummaryStrip, DateRangeFilter, url filters
    tabs/                      Jobs, Time, Expenses, WIP, Invoices (+ credit notes), Payments, Contacts
    settings/                  Billing, Team, Services, Rate overrides, Central, Danger zone
  central/                     chip, search, "Central clients" dialog, link dialog, formatting
  picker/ClientPicker.tsx      exported through features/clients/index.ts
  api/                         clients, central, workspace (tab lists), expenses (adapter), settings, lookup
  recents.ts                   recently viewed clients (zustand, persisted, per practice)
```

`workspace/abilities.ts` is the one place that turns a client and the caller's permissions into what
the UI offers (`edit`, `archive`, `restore`, `sync`, `link`, `unlink`, `seeRates`, `manageRates`).
Gating is UI only: the API checks every permission again.

## Header

Name (strong, upper case), code, type, status and the central chip: `Local`, `Linked` / `Synced
dd/MM/yyyy` (the date of the last confirmation, in the practice's time zone), `Stale`, `Not found
centrally`. Partner, manager and health follow. Actions: **Edit**, **Sync with central** (linked
clients), **Archive** / **Restore** (each behind a `ConfirmDialog`) and a More menu. A client
merged into another one shows "This client was merged into _Name (code)_" with a link and offers
no action at all: it is history.

## Tabs

| Tab      | Data                                                          | Needs                                                  | Notes                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overview | `GET /clients/{id}/overview` and the client                   | `client.read`                                          | six figure cards, WIP ageing bars, recent activity, the identifier, address, practice, notes and financial panels. A section the API returns as `null` has **no card**; if the figures fail the panels still show, with a retry where the figures were |
| Jobs     | `GET /jobs?client_id=`                                        | `job.read`                                             | search, status, **server** sort (number, due date)                                                                                                                                                                                                     |
| Time     | `GET /time-entries?client_id=&user_id=all\|me`                | `time.read_all` (everyone's) or `time.log` (own)       | hours as `h:mm`; date range, billable, billing status                                                                                                                                                                                                  |
| Expenses | `GET /disbursements?client_id=` through `api/expenses.ts`     | `wip.read` (all) or `disbursement.log`/`.manage` (own) | the adapter is the only file that knows the source; the tab shows `ExpenseRow`. Expense claims will only change that file                                                                                                                              |
| WIP      | `GET /clients/{id}/wip`                                       | `wip.read`                                             | totals, WIP by job, ageing, every item (job filter, "Show more" after 50)                                                                                                                                                                              |
| Invoices | `GET /invoices?client_id=` and `GET /credit-notes?client_id=` | `invoice.read`                                         | invoices / credit notes switch; **Statement (PDF)** (`GET /clients/{id}/statement/pdf`) with `payment.read`, for the dates picked                                                                                                                      |
| Payments | `GET /payments?client_id=`                                    | `payment.read`                                         | search, status (incl. on account), method, date received                                                                                                                                                                                               |
| Contacts | the client's contacts                                         | everyone; edits need `client.update`                   | add, edit, delete, make primary; primary and billing flags are shown                                                                                                                                                                                   |
| Settings | the client                                                    | everyone sees it; edits need `client.update` and more  | see below                                                                                                                                                                                                                                              |

Every table follows the same states: a busy table (`aria-busy`) while loading, an empty state that
says "nothing yet" or, with a filter set, "Nothing matches" with **Clear filters**, an error state
with **Try again** and the request id, and **Load more** with the API's cursor ("Showing 25 jobs").
The totals above a table come from the overview, so they stay right however many rows are loaded.
Money is `formatMoney` (pence), dates `dd/MM/yyyy`, hours `h:mm`; links come from `routes.ts`.

The tab badges come from `overview.tab_counts`; a tab the caller may not see is not drawn at all,
and a count the API returns as `null` has no badge.

## Settings

Each card saves (or acts) on its own and sends only what changed.

| Card           | Request                                                                                                                                                                                               | Notes                                                                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Billing        | `PATCH /clients/{id}` with the changed ones of `invoice_email`, `payment_terms_days`, `default_vat_rate_id`, `default_service_id`, `invoice_template_id`, `billing_notes` (a cleared field is `null`) | the billing contact is a flag of a contact: `PATCH …/contacts/{contactId} {is_billing}` — the new one is flagged first, then the old one cleared. A 422 lands on its field; a 404 naming a field says the choice is gone |
| Team           | `PATCH /clients/{id}` with `partner_user_id` and/or `manager_user_id` (`null`: nobody)                                                                                                                | listing the staff needs `member.read`; without it the card says so                                                                                                                                                       |
| Services       | `POST /clients/{id}/services`, `PATCH …/{engagementId}`, `DELETE …/{engagementId}`                                                                                                                    | the existing engagement dialog; fee typed in pounds, sent as pence                                                                                                                                                       |
| Rate overrides | `POST /clients/{id}/rates {user_id, hourly_rate, effective_from?, effective_to?}`, `PATCH …/rates/{id} {hourly_rate}`, `PATCH /rates/{id} {effective_to}`, `DELETE …/rates/{id}`                      | needs `rate.read` (card hidden without it) and `rate.manage`; status Current / Starts later / Ended; a delete refused with `RATE_IN_USE` suggests the end date                                                           |
| Central client | `POST /clients/{id}/central-sync`, `POST …/central-link {central_id}`, `DELETE …/central-link`                                                                                                        | shows the state, the central id and when it was last confirmed                                                                                                                                                           |
| Danger zone    | `POST /clients/{id}/archive`, `PATCH /clients/{id} {status: "active"}` (restore)                                                                                                                      | `client.delete`; each behind a confirmation                                                                                                                                                                              |

## Central clients

- **List page**: a `Central` column (hideable) and chip, a `central=linked|local` filter, the row
  action **Sync with central** (linked clients only), the toolbar **Sync all linked**
  (`POST /clients/central-sync`, result as a toast: synchronised, changed, not found, left over) and
  **Central clients**. A merged-away client shows "Merged into _Name_".
- **Central clients dialog** (`client.create`): `GET /central-clients?q=` 300 ms after typing stops;
  each row shows name, company number, address, status and either an `Enabled` chip with **Open
  client** or **Enable** (`POST /central-clients/{id}/enable`). The outcome is a toast with **Open
  client**: `created`, `linked_existing` (an unlinked client with the same company number was
  linked instead) or `already_enabled`. While the service is down the API answers from its cache:
  a `role="status"` banner says "Central service unavailable: showing cached data". A 503
  `CENTRAL_UNAVAILABLE` with nothing cached is an error state with a retry.
- **Linked clients**: the name and the address are managed centrally. In the edit dialog they are
  disabled and described by "Managed by the Capium central client service"; a 409
  `CLIENT_FIELD_MANAGED_CENTRALLY` (the client was linked while the form was open) is mapped onto the
  fields it names.

## Client 360 landing

A search card (`ClientPicker`, `GET /clients?q=`, archived clients included) that opens
`/clients/:id/overview`, **Recently viewed** (the last 8 clients opened in this practice, kept in this
browser by `recents.ts`; a client that no longer exists drops out; **Clear**) and the shortcut **Find a
client in Capium central** (`client.create`).

## ClientPicker

```tsx
import { ClientPicker, type ClientOption } from '@/features/clients';

<ClientPicker
  label="Client"
  value={clientId} // the chosen id, or null
  onChange={(client: ClientOption | null) => setClientId(client?.id ?? null)} // { id, name, code }
  error={errors.client?.message}
  disabled={locked}
  statuses={['active']} // optional; default: every status but archived
/>;
```

An async combobox (ARIA list autocomplete) over `GET /clients?q=` (20 matches, by name, 250 ms
debounce). Arrow keys and Enter choose, Escape closes only the list, a clear button empties it. A
`value` the picker did not choose itself is looked up to show its name. The team module has its own
picker for its forms; this one is the shared one.

## Deviations and notes

- Only jobs are sorted by the server; the other tabs sort the rows loaded so far.
- The WIP tab computes its ageing buckets from the items (30/60/90 days, as the API's summary does);
  the Overview shows the API's own ageing.
- `GET /central-clients` needs `client.create`: a role without it sees neither the toolbar button nor
  the shortcut.
- The previous in-page tabs of the client page (Contacts, Services, Rates) are now the Contacts tab and
  the Services and Rate overrides cards of Settings.
- The dev database needs the API restarted and `alembic upgrade head` (revision 018) before the new
  endpoints exist.
