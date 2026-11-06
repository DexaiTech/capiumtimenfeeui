# APT82 – "Page doesn't load": implementation plan

Status: **Plan ready for review — no code changed. Waiting for approval.**
Investigated on `origin/main` (`5059d4b`) of `capiumtimenfeeui` and on the live site
(`timenfee.dexaitech.com`) on 2026-11-06.

## 1. Original requirement

Ticket APT82 (Low), "Page doesn't load": _"Often when I am opening new pages, the system opens the
error screen. Post refreshing it loads again."_ Screenshot: WIP Summary showing **"This page could
not be loaded — A new version may have been released, or your connection dropped. Reload to
continue."** with a Reload button.

## 2. Requirement interpretation

Opening a page must not show an error screen just because a new version of the app was released
while the user's tab was open. The user should land on the page they clicked (the newest version),
without having to press Reload. A genuine connection problem should still say so.

## 3. Existing implementation (evidence)

| Piece                                                   | Where                                                                                                  | Behaviour                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| One code file ("chunk") per page, loaded on first visit | `src/app/router/pageLoaders.ts:15-…` (`() => import(...)` per page), `src/app/router/routes.tsx:24-26` | Each page's file name carries a content hash that changes with every release                                                               |
| Charts loaded on demand                                 | `src/components/charts/{Area,Bar,Donut,Line}Chart.tsx:7-11` (`React.lazy`)                             | Same mechanism                                                                                                                             |
| Error screen                                            | `src/pages/public/RouteErrorPage.tsx:15-22` (`isChunkLoadError`), `:42-55`                             | Shows exactly the ticket's message when a page file fails to download; "Reload" calls `window.location.reload()`                           |
| Web server                                              | `docker/nginx.conf.template`                                                                           | `index.html` `Cache-Control: no-cache` (refresh always gets the newest version); `/assets/*` `immutable` for a year, `try_files $uri =404` |
| Vendor code                                             | `vite.config.ts:48-51`                                                                                 | Library chunks kept stable across releases on purpose                                                                                      |

Live check (2026-11-06): an outdated page file name returns **404** (`/assets/ClientsPage-OLDHASH1.js`
→ 404 text/html), the current one 200. Release history on `main`: 28 commits on 3 Nov and 24 on
5 Nov, each deployed.

## 4. Root cause

A tab opened before a release keeps running the old version. The first time it opens a page it
hasn't visited yet, it asks for that page's **old** file name; the new release no longer has it, so
the server answers 404, the import fails and `RouteErrorPage` shows "This page could not be loaded".
A refresh downloads the new `index.html`, which names the new files, so the page loads — exactly the
ticket's symptom. It happens "often" because releases are frequent (dozens a day this week) and
people keep many tabs open for hours. Nothing is broken on the server: it is the expected result of
replacing a release, with no recovery step in the app.

## 5. Affected screens

Every page of the app (all routes use the same lazy loading through `PAGE_LOADERS` and
`lazyPage`) and every chart (dashboard, reports, time analysis). Public pages (login, register,
reset password) use the same mechanism.

## 6. Components and files involved

- `src/pages/public/RouteErrorPage.tsx` — the existing chunk-error branch.
- `src/main.tsx` — app entry (one listener).
- New `src/utils/reloadForNewVersion.ts` — one shared helper (≈20 lines).
- Tests: `src/pages/public/RouteErrorPage.test.tsx` (extend or add), a test for the helper.

## 7. Proposed solution

One shared rule, used everywhere a page or chart file fails to download: **reload once,
automatically, to pick up the new version.**

1. `reloadForNewVersion()`: if the browser is online and no automatic reload happened in the last
   30 seconds (timestamp in `sessionStorage`, wrapped in try/catch), store the time and call
   `window.location.reload()`; otherwise return `false`.
2. `main.tsx`: listen to Vite's `vite:preloadError` event (fired when a lazily loaded file can't be
   fetched) and call the helper — this covers pages and charts before they reach an error screen.
3. `RouteErrorPage`: when `isChunkLoadError` is true, call the helper on mount; only if it declines
   (offline, or a reload already happened seconds ago) show today's screen, whose wording stays.
   Non-chunk errors are untouched.

Result: after a release, clicking a page in an old tab reloads straight into that page on the new
version (one quick full-page load) instead of the error screen. A real outage still shows the
message, and a loop is impossible (one automatic reload per 30 s per tab).

Not proposed: keeping old releases' files on the server (needs a deployment/storage change outside
the UI code), or a "new version available" banner that polls the server (more moving parts; can be
added later if wanted).

## 8. UI changes

None visible in normal use. The error screen still appears when the user is offline or a reload
did not help.

## 9. API changes — none. 10. Database changes — none.

## 11. Edge cases

- Offline / flaky connection → no automatic reload; message shown (as today).
- Unsaved form data on the page the user is leaving: the reload happens on _navigation to a new
  page_, i.e. the old page was already being left; drafts kept in local storage (invoice drafts)
  are unaffected. Still checked in step 13.
- `sessionStorage` blocked (private mode, policies) → helper falls back to the message (no loop).
- Two failures within 30 s (server really down) → message, no second reload.
- Deep links (`/demo-practice/wip/...`) reload to the same URL.

## 12. Regression risks

- A reload loop — prevented by the 30 s guard; covered by a test.
- Masking real errors — only the chunk-error branch changes; other errors behave as today.
- Tests that render `RouteErrorPage` with a chunk error and expect the message — updated to the
  "already reloaded" path, not weakened.

## 13. Testing strategy

- Unit: helper (online/offline, guard window, storage failure); `RouteErrorPage` (chunk error →
  reload called once; second time → message; other errors → unchanged).
- Manual, local production build: build A, open a page, build B (new hashes) and serve it, click a
  page not yet visited in the old tab → lands on the page (no error screen); offline → message.
- Type check, lint, Prettier, production build, full vitest suite.

## 14. Acceptance criteria

1. After a release, opening a not-yet-visited page in a tab opened before the release shows the page
   (new version) without the error screen and without pressing Reload.
2. With no connection, the existing "This page could not be loaded" screen still appears.
3. No reload loop in any case (at most one automatic reload per 30 s per tab).
4. All other error screens and all existing tests behave as before.
