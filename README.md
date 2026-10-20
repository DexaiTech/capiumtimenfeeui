# Capium Time & Fees — UI

The web app of **Capium Time & Fees**: time recording, work in progress (WIP), billing and
fee accounting for UK accountancy practices. It talks to the FastAPI service in
`../capiumtimenfeeapi` (`/api/v1`), whose `docs/domain.md` is the contract for every rule
(money in pence, durations in minutes, VAT in basis points, the envelope, the permissions).

This build is the **foundation**: the app shell in the Capium design, sign-in and account,
practice settings, roles, the audit log, **Team & Rates** (staff, grades, cost and charge-out
rates, services, activity types, rate history, rate preview and re-rating), **Notifications**
(the bell, notification settings and email templates), **Clients** (the list, the central
clients and the Client 360 workspace with its tabs) and **Application Testing** (the bug and
enhancement tracker behind the bug button of the top bar). Every other module
has its route, navigation entry and permission gate in place, with a placeholder page that the
feature teams replace.

| Area                                                                                                                                                                                                                                                                                | Status                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Sign in, forgot / reset password, verify email, forced password change, register + create practice (open deployments only)                                                                                                                                                          | Built                                         |
| My account: profile, password, signed-in devices                                                                                                                                                                                                                                    | Built                                         |
| Settings → Practice (every billing setting), Roles & permissions, Audit log                                                                                                                                                                                                         | Built                                         |
| Team & Rates: Staff members, Grades, Cost rates, Charge-out rates, Services, Activity types, Rate history, Rate preview, Re-rate time (Settings → Staff moved here)                                                                                                                 | Built                                         |
| Notifications: the bell in the top bar (unread count, list, mark read), Settings → Notifications (your choices, the practice's switches and defaults), Settings → Email Templates (merge fields, preview, reset)                                                                    | Built                                         |
| Application Testing: the bug button in the top bar (Dashboard, All Tickets, New ticket), the ticket dashboard, the ticket list (filters, bulk actions, inline status and priority, tags), one ticket with its comments and files                                                    | Built                                         |
| Clients: the list (central column and filter, sync, central clients dialog), Client 360 landing (search, recently viewed), the client workspace (Overview, Jobs, Time, Expenses, WIP, Invoices, Payments, Contacts, Settings), `ClientPicker` ([design](docs/design/client-360.md)) | Built                                         |
| Dashboard, Jobs, Time (timesheet, timer, approvals), Billing (prepare invoice, invoices, credit notes, payments, debtors, statements, **Estimates** and **Recurring invoices**), Reports, Settings (VAT codes, document numbering and the rest)                                     | Built                                         |

## Stack

React 19 · TypeScript 6 · Vite 8 (Rolldown) · Tailwind CSS 4 (CSS-first tokens) ·
TanStack Query 5 · React Router 7 (data router, lazy routes) · react-hook-form + zod 4 ·
zustand (preferences only) · motion · lucide-react · recharts (charts kit) ·
Vitest 5 + Testing Library + MSW 2 · Playwright · ESLint (typescript-eslint strict, type-checked) ·
Prettier · Inter (`@fontsource-variable/inter`, self-hosted).

## Setup

Requirements: Node 22+ and npm.

```bash
npm install
cp .env.example .env.local   # optional: the defaults work with a local API
npm run dev                  # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8000` (override with `API_PROXY_TARGET`),
so start the API there first (see `../capiumtimenfeeapi/README.md`). The browser only ever
talks to one origin, which keeps the refresh cookie (path `/api/v1/auth`) same-origin.

## Scripts

| Script                            | What it does                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server on port 5173 with the `/api` proxy                                        |
| `npm run build`                   | Type-check (`tsc -b`) and build to `dist/`                                                |
| `npm run preview`                 | Serve the production build                                                                |
| `npm run typecheck`               | `tsc -b --noEmit` for the app, the configs and the e2e specs                              |
| `npm run lint`                    | ESLint with zero warnings allowed (includes the import boundaries)                        |
| `npm run format` / `format:check` | Prettier                                                                                  |
| `npm run test`                    | Vitest (watch); `npm run test -- --run` for one run                                       |
| `npm run test:e2e`                | Playwright smoke spec against the dev server (API mocked; `npx playwright install` first) |

## Environment variables

Only variables prefixed `VITE_` reach the browser bundle.

| Variable           | Default                 | Meaning                                                                                        |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `VITE_API_URL`     | `/api/v1`               | Base URL of the API, version prefix included. Relative means same origin (dev proxy or nginx). |
| `API_PROXY_TARGET` | `http://localhost:8000` | Dev server only: where `/api` is proxied. Not exposed to the browser.                          |
| `PLAYWRIGHT_PORT`  | `5173`                  | Port of the dev server the e2e spec starts.                                                    |

The Docker image (`Dockerfile`, `docker/nginx.conf.template`) serves `dist/` with nginx and
forwards `/api` to `API_UPSTREAM` (`API_HOST` is the `Host` header), set at run time.

## Project structure

```
src/
  app/            providers, router (routes.tsx, guards, shell wiring), zustand stores
  components/
    ui/           design-system primitives (no product knowledge): Button, Badge, Card, DataTable,
                  CountTabs, PageToolbar, SearchField, ColumnVisibilityMenu, InitialsAvatar,
                  HealthBar, EmptyState, Modal, Dropdown, Popover, Select, Switch, Toast, …,
                  Application Testing), AppShell, TopBar, SubNav, menus (quick create, practice, user, help, bell),
                  SearchDialog, MobileDrawer, AuthLayout, PageHeader
    charts/       chart kit on recharts (lazy implementation chunk)
    common/       Logo, PlaceholderPage, SectionCard, ThemeToggle, motion presets
    forms/        FormAlert, PasswordField, useSubmitError (422 → fields)
  constants/      routes.ts (path builders), navigation.ts (modules, sub-pages, permission rules),
                  permissions.ts (catalogue), queryKeys.ts, reports.ts, limits.ts
  features/       one folder per module; others import a feature only through its index.ts
    auth/ account/ organizations/ system/       sign-in, account, practice context, deployment mode
    settings/     practice, roles, audit pages + placeholders (rates, services, …)
    team/         staff, grades, cost and charge-out rates, services, activity types, rate
                  history, rate preview and re-rating (api/, schemas/, components/, pages/)
    notifications/ the bell's data, notification settings and email templates (api/, components/,
                  hooks/, test/); the two settings pages in settings/pages render its views
    tickets/      Application Testing, the bug and enhancement tracker: dashboard, list, ticket
                  detail with comments and files (api/, components/, hooks/, pages/, schemas/,
                  test/, utils/)
    clients/      the client list and Client 360: pages/ (list, landing, workspace), workspace/
                  (header, tabs, overview, settings cards), central/ (central clients), picker/
                  (ClientPicker), api/, recents.ts, test/
    dashboard/ jobs/ time/ billing/ reports/   pages/ with one page per file
  hooks/          usePermissions, useUrlParams, useDebouncedValue, useDocumentTitle, …
  pages/          shared pages: auth screens, /app redirect, onboarding, not found, route error
  services/api/   HTTP client: envelope, errors, in-memory access token, refresh, session events
  styles/         theme.css (tokens, light + dark), base.css
  test/           Vitest setup, MSW server, fixtures, render helpers
  types/          api.ts (envelope, Page, Pence, Minutes, BasisPoints), models.ts, organization.ts
  utils/          money.ts, minutes.ts, csv.ts, format.ts, cn.ts, …
tests/e2e/        Playwright smoke spec
```

Import boundaries are enforced by ESLint (`eslint.config.js`): `components/ui` knows nothing
about the product; components never import features or pages; features never import pages
or app wiring and use other features only through their `index.ts`; services, hooks, utils,
types and constants import no UI. The router is the one place that imports
`@/features/<module>/pages/*` directly, so every page is its own chunk.

## Routes

`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`,
`/change-password`, `/onboarding`, and `/app` (opens the practice used last, or the first).

Everything else lives under the practice slug, resolved once by
`GET /api/v1/organizations/by-slug/{slug}` into the practice context (practice, role,
permissions):

| Path below `/:orgSlug`                                                                                                                                                                   | Page                                  | Gate                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard` (index redirects here)                                                                                                                                                       | Dashboard                             | any member                                                                                                                                                                                                                                                                          |
| `clients`, `clients/360`, `clients/:clientId` (redirects to `overview`), `clients/:clientId/overview`, `jobs`, `time`, `expenses`, `wip`, `invoices`, `payments`, `contacts`, `settings` | Clients, Client 360, Client workspace | `client.read`; a tab also needs its own permission (`job.read`, `time.read_all` or `time.log`, `wip.read` or `disbursement.log`, `invoice.read`, `payment.read`) and an unknown or not permitted tab opens the overview; see [docs/design/client-360.md](docs/design/client-360.md) |
| `jobs`, `jobs/:jobId`                                                                                                                                                                    | Jobs                                  | `job.read`                                                                                                                                                                                                                                                                          |
| `time`, `time/timer`, `time/approvals`                                                                                                                                                   | Timesheet, Timer, Approvals           | `time.log` (approvals: `timesheet.approve`)                                                                                                                                                                                                                                         |
| `billing/wip`, `billing/invoices[/:invoiceId]`, `billing/credit-notes`, `billing/payments`, `billing/debtors`                                                                            | Billing                               | `wip.read` / `invoice.read` / `payment.read` per page                                                                                                                                                                                                                               |
| `reports`, `reports/:reportKey`                                                                                                                                                          | Reports                               | `report.read` (financial reports: `report.financial`)                                                                                                                                                                                                                               |
| `application-testing/dashboard`, `tickets`, `tickets/:ticketId` (the index redirects to the dashboard)                                                                                   | Application Testing                   | `ticket.read` (not one of the ten modules: the bug button of the top bar and its own sidebar lead here); creating, editing and deleting need `ticket.create`, `ticket.update`, `ticket.delete`                                                                                      |
| `team/staff`, `grades`, `cost-rates`, `charge-out-rates`, `services`, `activity-types`, `rate-history`, `rate-preview`, `re-rate`                                                        | Team & Rates                          | module: `member.read`, `rate.read` or `settings.manage`; staff and grades: `member.read`; rates, history and preview: `rate.read`; re-rate: `rate.manage`; services and activity types: any member                                                                                  |
| `settings/practice`, `roles`, `rates`, `services`, `activity-codes`, `vat-rates`, `numbering`, `audit`                                                                                   | Settings                              | module: `settings.manage`, `organization.update` or `member.read`; pages: see `constants/navigation.ts`                                                                                                                                                                             |
| `settings/notifications`, `settings/email-templates`                                                                                                                                     | Notifications, Email Templates        | notifications: any member (the practice's switches and defaults need `organization.update` or `settings.manage`); email templates: `organization.update` or `settings.manage`                                                                                                       |
| `account`                                                                                                                                                                                | My account                            | signed in                                                                                                                                                                                                                                                                           |

`constants/navigation.ts` is the single source of these rules: the top bar, the secondary
bar, the mobile drawer, the page search and the route guards all read it. Gating is UI only —
the API checks every permission again. Practice slugs cannot be one of the reserved
top-level words above.

## Money, time and the API

- `utils/money.ts`: `formatMoney(pence, currency = 'GBP')` → `£1,234.56` (Intl, en-GB, exact:
  amounts go to Intl as decimal strings); `parsePounds('1,234.5')` → `123450` through string
  digits, never `parseFloat`; `penceToPoundsInput`, `formatBasisPoints` (2000 → `20%`).
- `utils/minutes.ts`: `formatMinutes(90)` → `1:30`; `parseMinutes` accepts `h:mm`, decimal
  hours (`1.5`, `0,25`) and `1h 30m`; `roundUpToIncrement` mirrors the practice increment.
- `services/api`: `api.get/post/patch/put/delete` unwrap `{success, data, message, meta}`;
  `api.list` returns `{data, meta}` for cursor lists (`meta.next_cursor`). Errors are `ApiError`
  (`status`, `code`, `message`, `details`, `requestId`, `retryAfter`). The access token lives in
  memory only; a 401 triggers one shared `POST /auth/refresh` (cookie) and one retry. A 403
  `PASSWORD_CHANGE_REQUIRED` sends the person to the forced password change screen.
- Query keys: `constants/queryKeys.ts`. Practice data always starts with
  `['org', organizationId, …]` (`queryKeys.org.clients(id)` and friends are reserved for the
  modules to come).
- `hooks/usePermissions(context)` → `{ can, canAny, canAll }`; inside a practice route use
  `useOrg()` from `@/features/organizations` (same checks plus the practice and role).

## Design system

The Capium design: a full-width violet **top bar** (`bg-gradient-topbar`, white text) with
the round logo mark, the practice name over "PRACTICE MANAGEMENT" (`eyebrow` utility), the
modules with icons (active = translucent pill `bg-topbar-pill`), and on the right white
circle buttons (search, "+" quick create), the practice circle, help, notifications and the
user menu. Under it the white **secondary bar** (`SubNav`) centres the active module's
pages. The content area is light grey (`bg-bg`, #F7F7FB) with white rounded cards
(`Card`, `rounded-xl`, `shadow-card`).

- Tokens live in `src/styles/theme.css` (`@theme`); components only use the generated
  utilities (`bg-brand`, `text-text-muted`, `border-row-border`, `bg-badge-orange-soft`, …).
  Light is the default; `:root[data-theme='dark']` overrides the same tokens, and the user
  menu switches light → dark → system (`public/theme-init.js` applies it before first paint).
- Lists: `DataTable` (white card, soft row separators, checkbox column with select-all, sort
  headers, `hiddenColumns`, row actions, `toolbar`/`footer` slots) with `PageToolbar`
  (`CountTabs` "Clients 12", `SearchField`, outline buttons — `ColumnVisibilityMenu`, Filter,
  Export, Import — and one solid violet primary button) and `sortRows` for client-side sorting.
- `Badge` tones: `orange` (Limited), `blue` (Sole Trader), `red` (Overdue), `amber` (Due),
  `green` (Clear), `violet`, `grey`, plus the semantic ones. `InitialsAvatar` keeps a stable
  colour per id; `HealthBar` shows `84/100` with a green/amber/red bar; `EmptyState` for empty
  lists and pages.
- Buttons: `primary` (solid violet, one per screen), `outline`/`secondary`, `ghost`, `danger`.

## Adding a feature page

1. Replace the placeholder file, for example `src/features/clients/pages/ClientsPage.tsx`.
   Keep it a **default export** and keep the file name: the router lazy-loads it as is.
2. Put the feature's API calls in `src/features/clients/api/` (typed with `api` from
   `@/services/api`, keys under `queryKeys.org.clients(organizationId)`), components in
   `components/`, zod schemas in `schemas/`. Export what other features need from
   `src/features/clients/index.ts`.
3. Read the practice and permissions with `useOrg()`; hide actions the role cannot take
   (`can('client.create')`), and still handle the API's 403/409/422 (use `useSubmitError`
   for forms).
4. Use the design-system pieces (`PageHeader`, `DataTable`, `PageToolbar`, `Badge`,
   `formatMoney`, `formatMinutes`) and tokens only — no raw colours.
5. A new route or sub-page: add the path builder to `constants/routes.ts`, the entry (label,
   icon, permission rule) to `constants/navigation.ts`, and the route to
   `app/router/routes.tsx` with the same rule (`guardSubPage`).
6. Test with Vitest + MSW (`src/test/server.ts` has `ok`/`fail` envelope helpers,
   `renderInOrg` renders inside a practice) and run `npm run typecheck`, `npm run lint`,
   `npm run test -- --run` and `npm run build`.
