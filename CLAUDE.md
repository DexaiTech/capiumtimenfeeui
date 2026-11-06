# Capium Time & Fees UI: working guide

The web app of **Capium Time & Fees**: time recording, jobs, expenses, work in progress (WIP),
billing, reports, and team and rate administration for UK accountancy practices. It is a
single-page app that talks only to the FastAPI service in the sister repo
`../capiumtimenfeeapi` (`/api/v1`). That repo's `docs/domain.md` and `docs/modules/*.md` are the
contract for every endpoint and rule. Money is in pence, durations in minutes and VAT in basis points.

Read this file first, then [docs/system-overview.md](docs/system-overview.md) (the one-page map of
the whole product across both repositories), then the doc that matches the task (index below).

## Stack (from `package.json`)

| Area         | What it uses                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Core         | React 19, TypeScript 6 (strict, `noUncheckedIndexedAccess`), Vite 8 (Rolldown)                                          |
| Routing      | React Router 7: data router, one lazy chunk per page (`src/app/router`)                                                 |
| Server state | TanStack Query 5. Keys live in `src/constants/queryKeys.ts`                                                             |
| Client state | zustand 5, used only for preferences, some of them persisted (`src/app/store`, `src/features/clients/store.ts`)         |
| Forms        | react-hook-form, zod 4 (`import * as z from 'zod'`), `@hookform/resolvers`                                              |
| Styling      | Tailwind CSS 4 with tokens in `src/styles/theme.css`. The Clients list also has its own `src/styles/capium-clients.css` |
| UI libraries | lucide-react icons, motion, recharts (`src/components/charts`), TipTap (`RichTextEditor`)                               |
| Tests        | Vitest 5, Testing Library, MSW 2 (`src/test`), Playwright (`tests/e2e`)                                                 |
| Quality      | ESLint (typescript-eslint strict, type-checked, import boundaries) and Prettier                                         |

## Repo map

```
src/app/          App.tsx, providers/ (query client, toasts, auth, error boundary), router/ (routes.tsx,
                  pageLoaders.ts, guards.tsx, layoutRoutes.tsx), store/ (zustand: theme, last practice, shell)
src/components/   ui/ design-system primitives · layout/ shell (TopBar, Sidebar, SubNav, PageHeader…)
                  forms/ (FormAlert, useSubmitError) · common/ · charts/
src/constants/    routes.ts (path builders) · navigation.ts (modules, pages, access rules)
                  permissions.ts · queryKeys.ts · limits.ts · pageDescriptions.ts · reports.ts
src/features/<f>/ one folder per module: api/ hooks/ components/ pages/ schemas/ utils/ test/ index.ts
src/hooks/        usePermissions, useUrlParams, useDebouncedValue, usePersistentColumns, …
src/pages/        shared pages: auth screens, /app redirect, onboarding, not found, route error
src/services/api/ HTTP client: envelope, ApiError, in-memory token, refresh, session events
src/styles/       theme.css (tokens, light and dark) · base.css · capium-clients.css
src/test/         Vitest setup, MSW server, fixtures, render helpers
src/types/ src/utils/   shared types; money, minutes, dates, csv, cn, …
tests/e2e/        Playwright smoke spec
docs/             project documentation (index below)
```

## Commands

| Task              | Command                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Install           | `npm install` (Node 22+)                                                                                                                   |
| Dev server        | `npm run dev` serves http://localhost:5173 and proxies `/api` to `API_PROXY_TARGET` (default `http://localhost:8000`). Start the API first |
| API base URL      | `VITE_API_URL` (default `/api/v1`). It goes into the bundle. `API_PROXY_TARGET` is used by the dev server only                             |
| Type check        | `npm run typecheck` (`tsc -b --noEmit`)                                                                                                    |
| Lint              | `npm run lint` (ESLint, `--max-warnings 0`)                                                                                                |
| Format check      | `npm run format:check`, but see the CRLF note below                                                                                        |
| Unit and UI tests | `npx vitest run --maxWorkers=2 --testTimeout=120000 [path or pattern]`. `npm run test` is watch mode                                       |
| Production build  | `npm run build` (`tsc -b && vite build`)                                                                                                   |
| E2E               | `npm run test:e2e` (Playwright, desktop and mobile projects). Run `npx playwright install` once first. `PLAYWRIGHT_PORT` changes the port  |

### Local machine facts (read before running anything)

- **Vitest workers.** Always pass `--maxWorkers=2 --testTimeout=120000`. With more workers, tests
  time out falsely on this machine. A per-test timeout written in the test file still wins over
  the flag: `src/features/billing/pages/InvoiceDraftLines.test.tsx` sets 30 s and exceeds it here
  even on `main`. That failure is pre-existing. See `docs/testing.md`.
- **CRLF files.** `core.autocrlf=true`. Most files are stored with CRLF (`git ls-files --eol`
  shows about 1,180 `i/crlf` and about 140 `i/lf`). Scripted edits (sed, scripts) must keep
  each file's existing line endings.
- **Prettier warns on CRLF files.** Check formatting with
  `tr -d '\r' < <file> | npx prettier --stdin-filepath <file> --check`.
  Plain `prettier --check <file>` reports every CRLF file as unformatted.
- **No CI** runs in this repo. The checks above are the only gate.

## Documentation index

| Doc                                                                | What it covers                                                                                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/system-overview.md](docs/system-overview.md)                 | The whole product across both repositories: runtime, cross-cutting rules, area map, doc map (identical copy in the API repo)                        |
| [README.md](README.md)                                             | Product overview, setup, scripts, environment variables, design-system summary. Parts are out of date; see the note in `docs/architecture.md`       |
| [docs/architecture.md](docs/architecture.md)                       | App shell, routing, feature anatomy, API client, Query conventions, stores, auth, practice context, permissions, feature toggles, errors and toasts |
| [docs/ui-standards.md](docs/ui-standards.md)                       | **Read before any UI change.** Shared component catalogue, app-wide patterns, known inconsistencies                                                 |
| [docs/module-map.md](docs/module-map.md)                           | Each feature's routes, pages, components, endpoints and cross-feature dependencies                                                                  |
| [docs/testing.md](docs/testing.md)                                 | Vitest, MSW and render helpers, writing page tests, persisted stores, e2e, slow tests, running a subset                                             |
| [docs/coding-standards.md](docs/coding-standards.md)               | Naming, imports, typing, styling, accessibility, copy style, comments, commit messages                                                              |
| [docs/design/client-360.md](docs/design/client-360.md)             | Client workspace, Client 360 landing, central clients, `ClientPicker`                                                                               |
| [docs/design/clients-page.md](docs/design/clients-page.md)         | Figma spec of the Clients list (tokens, layout); renders in `docs/design/*.png`                                                                     |
| [docs/design/notifications.md](docs/design/notifications.md)       | The bell, notification settings, email templates                                                                                                    |
| [docs/design/settings-billing.md](docs/design/settings-billing.md) | VAT codes, document numbering, invoice templates                                                                                                    |
| [docs/design/team-rates.md](docs/design/team-rates.md)             | Team & Rates pages and behaviour                                                                                                                    |
| [docs/design/wip.md](docs/design/wip.md)                           | Work in Progress pages and endpoints                                                                                                                |
| `docs/implementation-plans/<TICKET_ID>.md`                         | One plan per ticket, written in step 4 of the workflow below                                                                                        |
| `../capiumtimenfeeapi/docs/modules/*.md`                           | API endpoints per module (the server-side contract)                                                                                                 |

## Before any code change (mandatory)

Applies to every ticket, feature, bug fix, refactor or other code change, however small.
Follow it in order; never start coding just because a ticket was given.

1. Read this file completely, then the docs relevant to the change (index above,
   `docs/ui-standards.md`, `docs/module-map.md`, `docs/system-overview.md`, the design notes)
   and any `docs/implementation-plans/*.md` on the same area. Don't treat a doc as outdated
   without checking it against the code.
2. Inspect the graphify knowledge graph of both repositories if one is available
   (`graphify-out/`, built with the graphify skill): related modules, shared components, the
   UI → API links, impact areas. It never replaces reading the source: verify findings in code.
   If it is missing, outdated or incomplete, say so and use the code and docs. Don't regenerate,
   overwrite or modify graphify outputs without approval.
3. Review the CEO / project lead's instructions and earlier agreed decisions; don't switch
   approach without explaining why and getting approval; ask when something is unclear.
4. Investigate the source: for each file to change, know why it changes, how it connects to
   the request, whether a shared component exists, who depends on it, which screens and
   workflows it affects, and what the docs say about it. Don't touch unrelated files; don't
   delete, rename, restructure or overwrite without a requirement and approval; never overwrite
   uncommitted changes.
5. Trace dependencies and workflows, then find the root cause.
6. Post a **pre-coding checkpoint report**: docs reviewed, graphify information reviewed,
   instructions reviewed, architecture understood, affected modules and dependencies, existing
   implementation, impact and regression risks, proposed approach, files expected to change.
7. Write the implementation plan (below) and **wait for approval. Only then modify code.**

## Engineering workflow (every ticket)

1. **Understand.** Read the whole ticket, including screenshots and comments, and restate it in
   your own words. Don't write any code yet.
2. **Investigate the entire application, not just the screen the ticket names.**
   - Find every screen that shares the pattern: modals, dropdowns, buttons, action icons,
     tables and grids, search, filters, forms, validation, notifications, navigation and permissions.
   - Compare how each one implements it.
   - Find the shared component and the correct app-wide behaviour (see `docs/ui-standards.md`).
3. **Find the root cause** with real code references, tracing the full flow UI → API → DB.
   Note what must be preserved. Never invent a cause; write "unverified" when you can't prove one.
4. **Write `docs/implementation-plans/<TICKET_ID>.md`** with these sections: original
   requirement, interpretation, existing implementation, root cause, affected screens, files,
   proposed solution, UI changes, API changes, DB changes, edge cases, regression risks,
   testing strategy and acceptance criteria. **Wait for approval before implementing.**
5. **Implement the plan.**
   - Reuse shared components.
   - Don't hardcode values.
   - Don't refactor what the ticket doesn't need.
   - Keep the change backward compatible.
   - If the plan has to change, explain the change before going on.
6. **Cross-screen verification (mandatory).** Revisit every screen found in step 2. Check
   different permission sets and responsive widths.
7. **Regression checks.** Run the unit and UI tests, type check, lint, format, production build
   and the relevant full suites.
   - Never weaken or remove a test.
   - Classify each failure as **pre-existing** (it fails on `main` too) or **new**.
   - Run the **full** UI suite before asking to merge, not only the touched files. A change to
     a shared component or to `navigation.ts` reaches screens the touched tests don't cover. On
     6 Nov 2026 a reorder of the Settings menu sent some roles to a "No access" page, and only
     the full suite caught it.
   - Look for React warnings in the test output (`same key`, `act(...)`): treat each as a bug.
8. **Manual verification** locally where it applies. Say clearly what was verified locally and
   what was verified in production.
9. **Final report** as a table with these columns: Ticket ID, Root cause, Implementation,
   Screens affected, Files modified, API changes, Database changes, Tests executed, Tests
   passed, Tests failed, Manual verification, Remaining issues, Commit, PR. Each ticket's status is
   one of: Investigated / Plan ready for review / Implementation in progress / Ready for review /
   Verified / Blocked.

**Rules:**

- Never close tickets; the developer updates the Application Testing dashboard.
- Never merge or deploy without explicit approval.

**Delivery:**

- One branch per ticket batch, with one PR per repo, merged by rebase.
- The API PR deploys before the UI PR.
- **After every merge, check the live site** before calling the work done:
  - the live site serves the new bundle;
  - `/api/v1/system` answers 200;
  - the changed screens open and look right, with nothing repeated or missing.

  If the site is down or broken, tell the lead at once, with what you know so far.

## Guard rails worth remembering

- **Import boundaries** are enforced by `eslint.config.js`:
  - `components/ui` imports no product code.
  - A feature uses another feature only through that feature's `index.ts`.
  - Only the router imports `features/*/pages/*`.
- **Page files.** A page is a default export. Register a new page in
  `src/app/router/pageLoaders.ts` and give it a nav entry and access rule in
  `src/constants/navigation.ts`.
- **Paths** come from `src/constants/routes.ts`. Never hand-write path strings.
- **Permissions.** Check permission codes (`PERMISSIONS`, `useOrg().can`), never role names.
  Gating in the UI is cosmetic: the API checks every permission again.
- **Colours.** Use tokens only (`bg-brand`, `text-text-muted`, `bg-badge-red-soft`, …), never
  raw hex in TSX.
- **Copy.** UI copy uses UK English and sentence case. Icon-button tooltips have no trailing "…".
- **List keys** must be unique among siblings and stable.
  - Key by an id. Never key by a label, a group or status name, or a date alone: those can
    repeat.
  - When nothing unique exists, combine the name with its place (`` `${index}:${name}` ``).
  - On 6 Nov 2026 the Settings left menu repeated its "Practice" pages four times. Two menu
    groups were both named "Practice" and `Sidebar.tsx` keyed them by name alone, so React left
    copies behind as the menu re-rendered.
  - A group name in `navigation.ts` may head two separate runs of pages. Every menu that groups
    pages (`Sidebar`, `ModuleSidebar`, `OverflowNav`) must cope with that.
