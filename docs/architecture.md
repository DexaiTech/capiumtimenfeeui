# Architecture

This document explains how the front end is wired, and every statement in it points to a file.
Each section gives the facts that hold across the whole app. For one module's own detail, see
[module-map.md](module-map.md) and `docs/design/*.md`.

## 1. Boot and providers

| Step           | File                                                      | What happens                                                                                                                                                             |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entry          | `src/main.tsx`                                            | Mounts `<App />` in `StrictMode` and loads the Inter font and `styles/base.css`                                                                                          |
| App            | `src/app/App.tsx`                                         | Creates the query client and the router once, then renders `AppErrorBoundary`, then `AppProviders`, then `RouterProvider`                                                |
| Providers      | `src/app/providers/AppProviders.tsx`                      | Nests the providers in this order: `QueryClientProvider`, `MotionConfig reducedMotion="user"`, `ThemeSync`, `ToastProvider`, `UnhandledRejectionToaster`, `AuthProvider` |
| Query defaults | `src/app/providers/queryClient.ts`                        | Sets `staleTime` to 30 s and turns off refetch on window focus. Queries retry at most 2 times, and only on `ApiError.retryable` (network or 5xx). Mutations never retry  |
| Theme          | `src/app/providers/ThemeSync.tsx`, `public/theme-init.js` | Resolves light, dark or system into `<html data-theme>`                                                                                                                  |

## 2. Routing

- **Route table.** `src/app/router/routes.tsx` (`appRoutes`), passed to `createBrowserRouter` in
  `src/app/router/index.ts`.
- **Page files.** `src/app/router/pageLoaders.ts` has two maps:
  - `PAGE_LOADERS[moduleId][pageId]` gives the lazily imported page file (a default export).
  - `DETAIL_ROUTES` covers the detail pages: client `:clientId/*`, `staff/:staffId`, job `:jobId`,
    the `mine|claims|approvals/:claimId` expense claims, and `invoices/:invoiceId`.
- **Navigation and access rules.** `src/constants/navigation.ts`:
  - It defines `NAV_MODULES`, the ten modules: dashboard, clients, time, jobs, expenses, wip,
    billing, reports, team and settings.
  - Each module has its pages (`SubPage`), and each page has an `AccessRule`: `anyOf` and
    `allOf` lists of permission codes.
  - The top bar, sidebar, mobile drawer, search and the route guards all read this file.
- **Path builders.** `src/constants/routes.ts` has `routes.org.*`, `modulePath` and
  `ORG_SEGMENTS`. Components never hand-write paths.
- **Guards.** `src/app/router/guards.tsx`:
  - `RequireAccess rule` renders the page, or `NoAccessPage`, which names the missing
    permission.
  - `ModuleIndexRedirect` sends a module's index to the first page the caller may open.
- **Layout routes.** `src/app/router/layoutRoutes.tsx`:
  - `AppShellRoute` draws the shell and runs the idle timeout. It warns at 25 minutes and signs
    out at 30 (`IDLE_WARNING_MS` and `IDLE_SIGN_OUT_MS` in `src/constants/limits.ts`).
  - `OrgRoute` resolves `:orgSlug` once through `GET /organizations/by-slug/{slug}` and
    provides `OrgProvider`.
  - `PublicLayoutRoute` wraps the public pages.
- **Sidebar modules.** Each module in `SIDEBAR_MODULES` (`navigation.ts`) has a
  `<Feature>LayoutPage` that renders `ModuleSidebarLayout` (`src/components/layout`). Its pages are
  nested under that layout, as `SIDEBAR_LAYOUTS` in `routes.tsx` sets up. Clients has no
  sub-navigation (`NO_SUBNAV_MODULES`).
- **Application Testing** (`/:orgSlug/application-testing/{dashboard,tickets,tickets/:ticketId}`)
  is outside `NAV_MODULES`. It has its own layout (`features/tickets/pages/TicketsLayoutPage`) and
  its own rule (`APPLICATION_TESTING_ACCESS`, which needs `ticket.read`).
- **Moved pages.** `MOVED` in `routes.tsx` lists old paths that now redirect. For example
  `settings/vat-rates` goes to `settings/vat-codes`, `billing/wip` to `wip`, and `team/services`
  to `settings/services`.
- **Pages borrowed across modules.**
  - Reports → Time analysis loads `features/time/pages/TimeAnalysisPage`.
  - Settings → Services loads `features/team/pages/ServicesPage`.
- **Error boundaries.**
  - `RouteErrorPage` (`src/pages/public/RouteErrorPage.tsx`) is the root `errorElement`, and is
    used again inside the shell, where the chrome stays and only the content shows the error.
  - `AppErrorBoundary` catches failures of the shell itself.

**Shell.** `src/components/layout/AppShell.tsx` draws the violet `TopBar`.

- From `lg` up there is a left `Sidebar`.
- Below `lg` there is `SubNav` (the module's pages in a row) plus `MobileDrawer`.
- The page heading is `PageHeader` (`src/components/layout/PageHeader.tsx`).

## 3. Feature folder anatomy

Every module lives in `src/features/<name>/`. Not every folder has every part.

| Part                               | Contents                                                                                                                          | Example                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `api/<x>Api.ts` or `api/<area>.ts` | Typed wrappers over `api` from `@/services/api`. Paths are built from a local `org(id)` helper that returns `/organizations/{id}` | `features/billing/api/billingApi.ts`, `features/dashboard/api/dashboardApi.ts` |
| `api/hooks.ts` or `api/<area>.ts`  | `useQuery`, `useInfiniteQuery` and `useMutation` hooks. They read `organization.id` from `useOrg()`                               | `features/jobs/api/hooks.ts` (`useJobList`, `useCreateJob`)                    |
| `api/keys.ts`                      | Query-key factories that extend `queryKeys.org.*`                                                                                 | `features/billing/api/keys.ts` (`billingKeys`)                                 |
| `api/invalidation.ts`              | One hook per change type that lists every key to mark stale                                                                       | `features/billing/api/invalidation.ts` (`useBillingInvalidation`)              |
| `api/pages.ts`                     | Cursor helpers `nextCursor`, `flattenPages` and `fetchEverything`, copied per feature                                             | `features/{billing,expenses,jobs,team,tickets,time,wip}/api/pages.ts`          |
| `components/`                      | Feature UI, often grouped in sub-folders                                                                                          | `features/billing/components/invoice/`                                         |
| `hooks/`                           | UI hooks such as `useUrlSearch`, filters and actions                                                                              | `features/billing/hooks/useUrlSearch.ts`                                       |
| `pages/`                           | One default-export page per file, plus `<Feature>LayoutPage.tsx`                                                                  | `features/jobs/pages/JobsPage.tsx`                                             |
| `schemas/`                         | zod form schemas                                                                                                                  | `features/jobs/schemas/job.ts`                                                 |
| `types.ts`, `constants.ts`         | API types, status label and tone maps                                                                                             | `features/jobs/constants.ts` (`JOB_STATUS_META`)                               |
| `utils/`                           | Pure helpers. `utils/errors.ts` (`dialogError`, `describeFailure`) is repeated per feature                                        | `features/jobs/utils/errors.ts`                                                |
| `test/`                            | `fixtures.ts`, `handlers.ts` (MSW), a render helper, `Where.tsx`                                                                  | `features/billing/test/`                                                       |
| `index.ts`                         | The public surface. Other features may import only from it                                                                        | `features/settings/index.ts`                                                   |

`jobs`, `reports`, `wip` and `help` have no `index.ts`, so no other feature imports them. This
is enforced by the `featureInternalsStrict` rule in `eslint.config.js`.

## 4. API client (`src/services/api`)

| Concern                | Where                                     | Behaviour                                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL               | `config.ts`                               | `API_BASE_URL = VITE_API_URL ?? '/api/v1'`. Only `/auth/*` calls send credentials (the refresh cookie)                                                                                                                                                                      |
| Calls                  | `client.ts`                               | `api.get/post/patch/put/delete` unwrap the envelope `{success, data, message, meta}`. `api.list` returns `{data, meta}` so a hook can read `meta.next_cursor`. There are also `api.withMessage`, `api.upload` (XHR with progress), `api.getBlob` and `api.openStream` (SSE) |
| Errors                 | `errors.ts`                               | Every failure is an `ApiError` with `status` (0 for network or timeout), `code`, `message`, `details`, `requestId` and `retryAfter`. `retryable` is true for status 0 and for 5xx. For a 5xx the client uses its own message instead of the server's                        |
| Timeout                | `transport.ts`, `constants/limits.ts`     | `REQUEST_TIMEOUT_MS = 20_000` by default. Blobs and streams have no timeout                                                                                                                                                                                                 |
| Auth token             | `tokenStore.ts`                           | Held in memory only, never in web storage                                                                                                                                                                                                                                   |
| Refresh                | `client.ts` (`withRefresh`), `refresh.ts` | On a 401, one shared `POST /auth/refresh`, then one retry. A second 401 calls `endSession('expired')`                                                                                                                                                                       |
| Cross-tab              | `channel.ts`                              | A `BroadcastChannel('capium-auth')` shares session, ended and refresh events between tabs                                                                                                                                                                                   |
| Forced password change | `transport.ts:248`                        | A 403 `PASSWORD_CHANGE_REQUIRED` emits an account notice. The app then routes to `/change-password`                                                                                                                                                                         |

## 5. TanStack Query conventions

- **Root keys** (`src/constants/queryKeys.ts`):
  - Account data lives under `['me', …]`.
  - Practice data lives under `['org', organizationId, …]`, so `queryKeys.org.all(id)` drops a
    whole practice.
  - Features add sub-keys such as `'list'`, `'detail'` and `'summary'` (see
    `features/billing/api/keys.ts`).
- **Shared roots.** Billing writes under `queryKeys.org.invoices`, `creditNotes` and `payments`,
  the same roots that the client workspace tabs read. A billing change therefore refreshes those
  tabs as well (comment in `billing/api/keys.ts`).
- **Invalidation.** Each mutation's `onSettled` calls an invalidation helper that lists the
  neighbouring data. For example, `useBillingInvalidation().invoices` refreshes invoices, WIP,
  clients, the dashboard, reports, debtors, statements and audit logs. Helpers exist in billing,
  expenses, jobs, team, tickets, time and wip (`api/invalidation.ts`). Settings uses
  local `useRefresh` functions instead (`settings/api/adminHooks.ts`, `billingHooks.ts`,
  `branchHooks.ts`).
- **Lists** use `useInfiniteQuery` with the API's cursor (`nextCursor`) and the shared
  `Pagination` "Load more" control. See [ui-standards.md](ui-standards.md).
- **List state** (search, filters, sort) lives in the URL query string through
  `useUrlParams` (`src/hooks/useUrlParams.ts`) and each feature's `useUrlSearch`, which debounces
  for 300 ms.

## 6. Client state (zustand) and persisted state

| Store                                                                          | File                                              | Storage                                                                    | Version / migration                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Last practice opened                                                           | `src/app/store/orgPreferenceStore.ts`             | localStorage `capium-org`                                                  | `version: 1`                                                                            |
| Return path after sign-up                                                      | `src/app/store/returnPathStore.ts`                | sessionStorage `capium-return-path`                                        | `version: 1`                                                                            |
| Theme                                                                          | `src/app/store/themeStore.ts`                     | localStorage `capium-theme`, also read by `public/theme-init.js`           | `version: 1`                                                                            |
| Shell (drawer, search, sidebar collapsed)                                      | `src/app/store/shellStore.ts`                     | Not persisted, except a guarded `capium.sidebar.collapsed` key             | n/a                                                                                     |
| Clients list prefs (hidden columns, list/grid, saved filter sets per practice) | `src/features/clients/store.ts`                   | localStorage `capium-clients` through `guardedStorage`, which never throws | **`version: 2`**. `migrate` adds `'central'` to `hiddenColumns` for older saves (APT74) |
| Recently viewed clients                                                        | `src/features/clients/recents.ts`                 | localStorage `capium-clients-recent` through `guardedStorage`              | `version: 1`                                                                            |
| Hidden columns of other lists                                                  | `src/hooks/usePersistentColumns.ts` (not zustand) | localStorage `tf:columns:<id>`, in try/catch                               | none                                                                                    |

Rules that the code shows:

- Web storage holds preferences only, never tokens. An ESLint `no-restricted-syntax` rule
  catches bare `localStorage` and `sessionStorage`.
- When a persisted shape changes, bump `version` and add a `migrate` step, as `clients/store.ts`
  does. Test it by seeding the old shape, as `features/clients/test/central.test.tsx` does
  around line 156.

## 7. Auth, practice context and permissions

- **Auth.** `features/auth`:
  - `AuthProvider` and `useAuth` hold `status`, `user`, `logout` and `refreshUser`.
  - The route guards are `RequireAuth`, `RequireVerified` and `RedirectIfAuthenticated`.
  - `OpenDeploymentOnly` (`features/system`) hides register, forgot-password and onboarding in a
    closed deployment.
- **Practice context.** `features/organizations/orgContext.ts`. `useOrg()` returns
  `{ organization, role, permissions, centralClientEnabled, can, canAny }` and throws outside
  `/:orgSlug`. `useOptionalOrg()` returns null there instead. Tests provide the context with
  `OrgProvider`.
- **Permission codes.** `src/constants/permissions.ts` (`PERMISSIONS`) mirrors the API's
  `app/core/permissions.py`. Always check codes, never role names; `OWNER_ROLE_KEY` is for display
  only.
- **Gating in the UI:**
  - Routes use `RequireAccess` with the page's `AccessRule`.
  - Elements use `useOrg().can(PERMISSIONS.x)`, or `<Can permission>`
    (`features/organizations/components/Can.tsx`).
  - Some features centralise their abilities. `features/clients/workspace/abilities.ts` turns
    a client and the caller's permissions into `edit`, `archive`, `sync` and similar flags.
  - `hooks/usePermissions.ts` also offers `canAll`, but `useOrg()` does not expose it.
- **The API checks every permission again.** The UI must still handle 403, 409 and 422.

## 8. Practice feature toggles

| Toggle                     | Source                                                                                                                     | Read with                                                                                                   | Effect                                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branches                   | `organization.branches_enabled` (`types/organization.ts`)                                                                  | `useBranchesEnabled()`, exported by `features/settings`                                                     | Off: branch fields and filters are hidden, and `useBranches(false)` fetches nothing. On: every client needs a branch (APT74)                                                              |
| Client segments            | `organization.client_segments_enabled`                                                                                     | `useSegmentsEnabled()` (`features/settings`)                                                                | Off: segments are hidden everywhere. The data is kept                                                                                                                                     |
| Capium Central integration | `OrganizationContext.central_client_enabled`                                                                               | `useCentralEnabled()` (`features/clients/central/useCentralEnabled.ts`), or `useOrg().centralClientEnabled` | Off: the Central column, chip, filter, buttons, row action and settings card are not drawn. Switched in Settings → Integrations (`settings/api/adminHooks.ts` patches the cached context) |
| Approval flows             | `require_timesheet_approval`, `expense_approval_required`, `wip_adjustment_approval_required`, `invoice_approval_required` | `approvalOn` (`src/utils/approvals.ts`). `approvalPageOn` and `visibleModules` in `navigation.ts`           | Off: approval pages leave the navigation, and `ApprovalOffNotice` explains anything still waiting                                                                                         |
| Rate mode, overtime        | `organization.rate_mode` (`staff_first`, `grade_only`, `staff_only`), `overtime_enabled`                                   | Read from `useOrg().organization`                                                                           | These change rate screens and time entry. Details in [module-map.md](module-map.md) (team, time)                                                                                          |

## 9. Errors and toasts

| Situation                      | Mechanism                                                                                                                                                                                                                                                               | File                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A form submit fails            | `useSubmitError({ setError, fields })`. 422 details go to fields and focus the first one; 429 disables submit with a countdown; network and 5xx show a toast plus an inline message; anything else shows the server message inline. Show `submitError` with `FormAlert` | `src/components/forms/useSubmitError.ts`, `FormAlert.tsx`                       |
| A page or list fails to load   | `ErrorState` (message, request ID, **Try again**), usually wrapped in a feature `LoadError` card                                                                                                                                                                        | `src/components/ui/ErrorState.tsx`, `features/billing/components/PageShell.tsx` |
| A dialog action is refused     | `ConfirmDialog error` or `dialogError(error)` from the feature's `utils/errors.ts`                                                                                                                                                                                      | `src/components/ui/ConfirmDialog.tsx`                                           |
| An outcome to announce         | `useToast().toast({ tone, title, description?, action?, duration? })`. Tones are success, error, warning and info. Toasts close after 5 s by default (`0` keeps one open). They appear at the top on mobile and bottom-right from `md`                                  | `src/components/ui/toastContext.ts`, `Toast.tsx`                                |
| An unhandled promise rejection | A global "Something went wrong" toast                                                                                                                                                                                                                                   | `src/app/providers/UnhandledRejectionToaster.tsx`                               |
| A render crash                 | `RouteErrorPage` (route level) and `AppErrorBoundary` (shell)                                                                                                                                                                                                           | see §2                                                                          |
| Unsaved work                   | `useBlocker` (needs a data router) and `useBeforeUnload` (`features/settings/hooks`)                                                                                                                                                                                    | `features/billing/pages/InvoiceDetailPage.tsx`                                  |

## 10. Notes on existing docs and comments

- **README.md is partly out of date:**
  - The intro says the other modules are placeholders, but its own table marks every area Built.
  - The route table still lists `billing/wip`, `settings/rates`, `settings/vat-rates`,
    `settings/numbering`, `settings/audit` and `time/timer`. These now redirect (`MOVED` in
    `routes.tsx`). It also omits the Expenses and WIP modules, Leads and Help.
  - It describes a centred secondary bar. From `lg` up, navigation is now the left `Sidebar`.
  - The `components/ui` line of the project tree is garbled, and the `layout/` entry is missing.
  - It says `useOrg()` offers the same checks as `usePermissions`, but `useOrg()` has no `canAll`.
- **queryKeys.ts** says its `org.clients` and related keys are "reserved for the feature modules
  built next". They are in use. The README repeats the same claim.
- **Missing docs.** Source comments point to `docs/api.md` (`src/test/server.ts`),
  `docs/frontend.md` (`src/app/providers/queryClient.ts`) and `docs/error-handling.md`
  (`useSubmitError.ts`). None of these files exists in this repo or in `../capiumtimenfeeapi/docs`,
  checked on 2026-11-05.
- **docs/design/client-360.md** lists nine workspace tabs. The code also has **Invoices &
  Recovery** (`recovery`) and **History** (`history`) in
  `features/clients/workspace/constants.ts`.
- **docs/design/clients-page.md** records an older scope: "only the Clients menu", and a
  three-dot row menu. The app now has ten modules and icon-button row actions (`RowActions`).
