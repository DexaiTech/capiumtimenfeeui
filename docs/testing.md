# Testing

There are two kinds of test:

- **Unit and UI tests:** Vitest with Testing Library and MSW, in about 224 `*.test.ts(x)` files
  under `src`.
- **End-to-end:** a Playwright smoke spec in `tests/e2e`.

There is no CI in this repo. Run the checks yourself (see [../CLAUDE.md](../CLAUDE.md)).

## 1. Running tests

On this machine, always use the flags shown here. With more workers, tests time out falsely.

```bash
# everything (slow): one run, not watch mode
npx vitest run --maxWorkers=2 --testTimeout=120000

# one feature or folder
npx vitest run src/features/billing --maxWorkers=2 --testTimeout=120000

# one file
npx vitest run src/features/clients/pages/Client360Page.test.tsx --maxWorkers=2 --testTimeout=120000

# tests whose name matches
npx vitest run src/features/jobs -t "bulk" --maxWorkers=2 --testTimeout=120000

# the mandatory-field tests only
npx vitest run required --maxWorkers=2 --testTimeout=120000
```

`npm run test` starts watch mode (`vitest`). For a single run, use `npx vitest run` as above.

## 2. Configuration

| Setting         | Value                                                                                   | File                      |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------- |
| Environment     | `jsdom` at `http://localhost:3000`, `globals: true`, `css: false`, `restoreMocks: true` | `vite.config.ts` (`test`) |
| Files           | `src/**/*.test.{ts,tsx}`                                                                | `vite.config.ts`          |
| Default timeout | `testTimeout: 20_000`. `src/test/renderApp.tsx` also sets 20 s                          | `vite.config.ts`          |
| Setup           | `src/test/setup.ts`                                                                     | see below                 |

`src/test/setup.ts`:

- loads `@testing-library/jest-dom/vitest`;
- sets `asyncUtilTimeout` to 5000 ms ("the default 1 s is too tight… on a busy machine");
- polyfills `matchMedia`, plus the `Range` and `Element` rect functions that ProseMirror needs;
- starts the MSW server with **`onUnhandledRequest: 'error'`**, so any request without a handler
  fails the test;
- after each test, runs `cleanup()`, `server.resetHandlers()` and `tokenStore.clear()`, and
  **clears `localStorage`** so remembered columns and filters don't leak between tests.

## 3. Helpers in `src/test`

| Helper                                                                                                                                                           | File                | Use                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server`, `apiPath(path)`                                                                                                                                        | `server.ts`         | The MSW server. `apiPath('/auth/login')` matches `*/api/v1/auth/login`                                                                                                       |
| `ok(data, { status, message, meta })`, `fail(status, code, message, { details, headers, requestId })`                                                            | `server.ts`         | Build the real success and error envelopes                                                                                                                                   |
| `defaultHandlers`                                                                                                                                                | `server.ts`         | `GET /system` (an open deployment) and the bell's unread count                                                                                                               |
| `readUpload(request)`                                                                                                                                            | `server.ts`         | Reads the field name and content type of a multipart upload                                                                                                                  |
| `renderWithProviders(ui, { route, dataRouter })`                                                                                                                 | `render.tsx`        | Query client (no retries), `MotionConfig reducedMotion="always"`, `ToastProvider`, and a memory router (or a data router when `dataRouter` is set, which `useBlocker` needs) |
| `renderInOrg(ui, { context, user, route, dataRouter })`                                                                                                          | `renderInOrg.tsx`   | As above, signed in (`AuthContext`) and inside a practice (`OrgProvider`)                                                                                                    |
| `orgApiPath(path, context?)`                                                                                                                                     | `renderInOrg.tsx`   | Builds `*/api/v1/organizations/{test org id}{path}` for handlers                                                                                                             |
| `renderApp(route, { user })`, `resetAppStores()`                                                                                                                 | `renderApp.tsx`     | The real route table with every provider, and the session restored through a mocked `/auth/refresh`. Call `resetAppStores()` in `beforeEach`                                 |
| `ownerContext`, `memberContext`, `centralOffContext`, `contextWith(permissions, base?)`, `OWNER_PERMISSIONS`, `STAFF_PERMISSIONS`, `mockOrganizations(contexts)` | `orgFixtures.ts`    | Practice contexts and permission sets. The test practice's slug is `acme`, and Central is on                                                                                 |
| `testUser`, `testAuth`, `testSession`                                                                                                                            | `fixtures.ts`       | Account fixtures                                                                                                                                                             |
| `branchesOnContext`, `branchHandlers`, `london`, `leeds`, `bath`                                                                                                 | `branches.ts`       | Practices with branches turned on                                                                                                                                            |
| `segmentHandlers`, `gold`, `silver`, `retail`                                                                                                                    | `segments.ts`       | Client segments                                                                                                                                                              |
| `mockClosedDeployment`, `mockOpenDeployment`                                                                                                                     | `systemFixtures.ts` | Deployment mode                                                                                                                                                              |
| `rowAction(group, action)`, `findRowAction`, `rowActionNames`, `rowActionsOf`                                                                                    | `rowActions.ts`     | Find `RowActions` buttons by their group name ("Actions for Acme Ltd")                                                                                                       |
| `expectRequiredFields(scope, { required, optional })`                                                                                                            | `requiredFields.ts` | Asserts the red star (`field-required`) and `aria-required`                                                                                                                  |

## 4. Feature test folders and MSW conventions

Most features keep a `test/` folder, for example `features/billing/test`,
`features/clients/test` and `features/tickets/test`. It usually contains:

- **`fixtures.ts`:** typed API objects.
- **`handlers.ts`:** handler factories, for example `clientsHandlers({ onList })`. Billing keeps a
  stand-in backend object (`BillingBackend`) whose state the handlers read and change, and which
  records every `Call` (`method`, `path`, `body`, `params`) so tests can assert on requests.
- **`render.tsx`:** for example `renderBillingPage(page, { permissions, organization, route, path })`.
  It mounts the page in `<Routes>` with a catch-all, sets the context permissions, and uses
  `dataRouter: true`.
- **`Where.tsx`:** renders the current location (`data-testid="location"`) so a test can assert
  that a navigation happened.

Conventions that the existing tests show:

- Add handlers per test with `server.use(...)`. Order matters: a more specific path
  (`/clients/summary`) must be registered before `/clients/:clientId`, as the comment in
  `Client360Page.test.tsx` notes.
- Assert requests by capturing their parameters, for example `onList: (params) => seen.push(params)`.
- Return refusals with `fail(409, 'CODE', 'message')`, and 422s with
  `details: [{ field, message }]`, to test `useSubmitError` mapping.
- Query by role and accessible name (`getByRole('button', { name: 'Edit' })`), not by test ids.
  The one exception is `Where`'s `location`.

## 5. Writing a page test (pattern)

Based on `src/features/clients/pages/Client360Page.test.tsx`. `ThingsPage`, `/things` and `things.*` are placeholders.

```tsx
import { screen } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import ThingsPage from './ThingsPage';

function renderPage(permissions = OWNER_PERMISSIONS) {
  server.use(
    http.get(orgApiPath('/things'), () => ok([], { meta: { next_cursor: null, has_more: false } })),
  );
  return renderInOrg(<ThingsPage />, { route: '/acme/things', context: contextWith(permissions) });
}

describe('ThingsPage', () => {
  it('hides Add for a role without things.create', async () => {
    renderPage(['things.read']);
    expect(await screen.findByRole('heading', { level: 1, name: 'Things' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add thing' })).not.toBeInTheDocument();
  });
});
```

Cover these cases for a page:

- the loading, empty, filtered-empty and error states;
- each permission variant (`contextWith`);
- each practice toggle (`centralOffContext`, `branchesOnContext`);
- the request that each action sends;
- the toasts and dialogs that follow.

**Mandatory-field tests** live in `*.required.test.tsx` files (14 of them), for example
`features/tickets/test/required.required.test.tsx`, and use `expectRequiredFields`.

**Routing tests** in `src/app/router/*.test.tsx` stub `./pageLoaders` with `vi.mock`
(`orgRouting.test.tsx`, line 17). Pages can therefore change without breaking them.

## 6. Persisted-store tests

Persisted zustand stores rehydrate from `localStorage`. `setup.ts` clears it after each test.

- Reset the store state in `beforeEach`. For example `Client360Page.test.tsx` calls
  `useRecentClientsStore.setState(INITIAL_RECENT_CLIENTS)`, and app-level tests call
  `resetAppStores()`.
- To test a **migration**, write the old persisted shape and rehydrate it. For example, in
  `features/clients/test/central.test.tsx` (~l.155):

  ```ts
  window.localStorage.setItem(
    CLIENTS_PREFS_KEY,
    JSON.stringify({ state: { hiddenColumns: ['reg_no'], view: 'list', presets: {} }, version: 1 }),
  );
  await useClientsPrefs.persist.rehydrate();
  expect(useClientsPrefs.getState().hiddenColumns).toEqual(['reg_no', 'central']);
  ```

- `usePersistentColumns` has its own test, `src/hooks/usePersistentColumns.test.tsx`.

## 7. End-to-end (Playwright)

| Item    | Value                                                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config  | `playwright.config.ts`: `testDir: './tests/e2e'`, the projects **desktop** (Desktop Chrome) and **mobile** (Pixel 7), `fullyParallel`                                                                               |
| Server  | Starts `npm run dev -- --strictPort --port $PLAYWRIGHT_PORT` (default 5173), or reuses one that is already running outside CI                                                                                       |
| Browser | `npx playwright install` once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a system Chromium                                                                                                                     |
| Specs   | `tests/e2e/smoke.spec.ts` has 2 tests: anonymous visitor goes to the login page and the form validates; a practice route redirects to login with a return path. The API is mocked with `page.route('**/api/v1/**')` |
| Run     | `npm run test:e2e`                                                                                                                                                                                                  |

## 8. Known slow or flaky tests

| Test                                                                                                                              | Symptom                                                                                                                                                        | Status                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/features/billing/pages/InvoiceDraftLines.test.tsx`                                                                           | Its last test sets its own `30_000` ms timeout (~l.401). A per-test timeout overrides `--testTimeout=120000`, and this machine exceeds 30 s **even on `main`** | Pre-existing. Report it as pre-existing, not as a regression                              |
| Whole-app tests (`renderApp`) and every test under parallel load                                                                  | Lazy route chunks load slowly on a cold run                                                                                                                    | Mitigated by the 5 s `asyncUtilTimeout` and the 20 s test timeouts. Keep `--maxWorkers=2` |
| `src/features/time/components/timesheet/WeekView.test.tsx` (~l.160), `src/features/auth/components/AuthProvider.test.tsx` (~l.52) | Use explicit `{ timeout: 3000 }` waits                                                                                                                         | Not observed failing (unverified)                                                         |

When a test fails:

1. Re-run that file alone with the flags above.
2. Check it on `main` before calling it a regression.
3. Never weaken or delete a test to make it pass.

## 9. Other checks

```bash
npm run typecheck   # tsc -b --noEmit: the app, the configs and the e2e specs
npm run lint        # ESLint, zero warnings, including the import boundaries
tr -d '\r' < <file> | npx prettier --stdin-filepath <file> --check   # per file (CRLF-safe)
npm run build       # tsc -b && vite build
```
