# TIMEFEE-NAV: Raj's navigation requirements, and the Opening Balances link

- **Status:** ready for review. The plan was approved on 8 Nov and implemented on local branch
  `jaasir` (from `main` `76f37ba`), not committed.
- **Outcome:** two code files and two test files changed:
  - targeted tests 100/100; the full UI suite 239 files, 2,766/2,766;
  - `tsc`, ESLint, Prettier and the build pass;
  - the isolated manual check passed.

  Q1–Q6 stay open.

- **Raised by:** Raj B (chat, 7 Nov 2026) and the follow-up task "Complete Raj's Navigation
  Requirements" (8 Nov 2026).
- **Code reviewed:** UI `origin/main` `76f37ba` (live since 04:22 UTC 8 Nov, bundle
  `index-YHHh-72G.js`).

## 1. Original requirement

Raj, verbatim:

- "Lots of areas are hallucinating – menu wise and navigation wise"
- "when you clicking leads, its removing client menu … its hiding"
- "It should be part of top client menu and that client and lead tab should be there"
- "Navigation missing completely"
- "Lead – synthetic data need to be inserted"
- "Somehow missing the phase"

The task restates the one known remaining issue: the old Opening Balances link opens
Import/Export on the Clients tab.

## 2. What is already done (released)

| Requirement                                                                | Implementation                                                                                                                                      | Evidence                                                                                                       |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Leads inside the Clients top menu; the Clients menu stays when Leads opens | Clients module pages Client List, Client Overview and Leads; **Clients** stays active in the top bar                                                | Sweep below: Clients active on `/clients`, `/clients/leads`, `/clients/360` and a client page, for all 7 roles |
| Client and Lead tabs                                                       | Shared `ClientsLeadsSwitch` on the Client List toolbar and the Leads page (Raj chose tabs over a sidebar, 7 Nov)                                    | Gap review G-01; isolated checks 4.7                                                                           |
| Menu rules equal page rules                                                | Lock Past Periods `anyOf [period_lock.read, period_lock.manage]`; Import/Export `anyOf [client.create, data.import_export, opening_balance.import]` | Verification §2 (2.1–2.8)                                                                                      |
| One active sidebar item; labels wrap                                       | `activePageId` honours `alsoActiveOn`; the sidebar uses a plain `Link`; labels wrap                                                                 | Sweep: at most one active item per nav, no cut labels                                                          |
| No repeated Settings menu                                                  | Unique React keys (UI #21)                                                                                                                          | Sweep: no duplicate items in any nav                                                                           |

## 3. Verification run for this plan (isolated, 8 Nov)

The UI code is identical to production `main`. The run used the synthetic database
`capium_preprod_verify`, with roles Owner, Admin, Partner, Manager, Billing, Staff and Viewer.

- **Page sweep:** 15 pages × 7 roles, each loaded directly and then refreshed. Results: no page
  errors; **no duplicate** menu items; **no cut-off** labels; **exactly one** top-bar module and at
  most one sidebar item active; **every refresh kept its URL and active item**. "No access" appears
  only where the role lacks the page's permission (for example Staff on Invoices, Viewer on VAT
  Summary). Evidence: `NAV-sweep.json`.
- **Top-bar clicks:** every module for every role. **Every module opens a page the role may use.**
  For example, Time for Billing and Viewer opens Time Entries, because they cannot use My
  Timesheet. Evidence: `NAV-topbar-clicks.json`.

## 4. Confirmed defect: the Opening Balances link

- **Intended destination:** commit `152fbc0` (20 Oct) moved the feature to "an 'Opening Balances'
  tab to Settings > Import/Export", replacing the Billing placeholder "with a redirect from its old
  URL". The comment in `routes.tsx:155` says the same.
- **Actual:** `/:slug/billing/opening-balances` → `/:slug/settings/import-export` with the
  **Clients** tab selected (verification 2.6; the sweep, every role).
- **Root cause:**
  - `routes.tsx:156` redirects to the page only. The `MOVED` table has no way to name a tab.
  - `ImportExportView.tsx:33` always starts on `useState<ImportExportTab>('clients')` and never
    reads the URL.
  - This dates from `152fbc0`; it is not a regression from the 8 Nov release.
- **Affected screens:** only Settings → Import/Export. `ImportExportView` is used only by
  `ImportExportPage`, and there are no in-app links to `billing/opening-balances`; the old URL
  exists only in bookmarks and old documents.

## 5. Proposed solution (minimal)

1. **`src/app/router/routes.tsx`:** change the redirect target to
   `settings/import-export?tab=opening-balances`. The `MOVED` mechanism and every other entry are
   unchanged.
2. **`src/features/settings/components/importExport/ImportExportView.tsx`:**
   - The selected tab comes from the `tab` search parameter when it is one of the four known tab
     values, and is `clients` otherwise, as today.
   - Changing tabs writes `?tab=<value>` with `replace`, so a refresh keeps the tab and Back is
     not filled with tab clicks.
   - Permissions are untouched: each tab still enables or disables its own actions, exactly as now.
     A Manager who follows the old link sees the Opening Balances tab with its import disabled and
     the reason shown, as when clicking that tab today.

**No change to:**

- API, database, permissions, menu rules, or the guard (Staff and Viewer still get "Your role does
  not include this page" on Import/Export);
- any other redirect or page.

## 6. Edge cases

| Case                                                 | Behaviour                                             |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `?tab=` unknown or empty                             | Clients tab (today's default)                         |
| Plain `/settings/import-export`                      | Clients tab (unchanged)                               |
| Old link, role without Import/Export (Staff, Viewer) | Redirect, then the same "not included" page as today  |
| Old link, Manager (no `opening_balance.import`)      | Opening Balances tab, import disabled with its reason |
| Refresh after choosing a tab                         | The same tab                                          |

## 7. Regression risks

- **Low.** Two files, one screen.
- The existing redirect test checks the pathname only, so it still holds.
- `ImportExportPage.test.tsx` must keep passing: its tests click tabs, and the default stays
  Clients.

## 8. Testing strategy

- **New, `orgRouting.test.tsx`:** the old address opens Import/Export with **Opening Balances**
  selected (Billing context).
- **New, `ImportExportPage.test.tsx`:** `?tab=opening-balances` selects it; an unknown `?tab` falls
  back to Clients; clicking a tab updates `?tab`.
- **Unchanged suites:** `ImportExportPage`, `orgRouting`, `Sidebar`, `TopBar`, `ClientsLeadsSwitch`,
  `LeadsPage`.
- **Checks:** `tsc`, `eslint --max-warnings 0`, the CRLF-safe Prettier check, `npm run build`, and
  the **full UI suite** (`vitest --maxWorkers=2`), per the release-safety rule.
- **Manual, isolated:** the old link for Owner, Billing, Manager and Staff; refresh on each tab;
  the menus are unchanged (rerun the top-bar click check).

## 9. Acceptance criteria

- `/:slug/billing/opening-balances` opens Settings → Import/Export with **Opening Balances**
  selected, for every role that can open Import/Export.
- Every other navigation result in §3 is unchanged.
- No API, database or permission change. All tests pass; no test is weakened.

## 10. Needs Raj's decision (not implemented, not marked complete)

| #   | Question                                                                                                                                                                                                                           | Why it is open                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Q1  | **Client Overview** (`/clients/360`, the client search and recent-clients page) has no desktop entry: the switch shows only Clients and Leads. Should it become a third tab, or stay reachable through search and the mobile menu? | Gap review G-02 was to be fixed by the sidebar, which Raj replaced with tabs |
| Q2  | **"Somehow missing the phase"**: which phase? Candidates, strongest first: the APT81 overtime recalculation; a lead-to-prospect step; engagement-based recurring invoicing                                                         | Gap review G-11                                                              |
| Q3  | Settings shows **"Practice" twice** (two runs, with Access control between). Merge them? Merging changes where Settings opens for some roles                                                                                       | Gap review G-10                                                              |
| Q4  | **"Navigation missing completely"**: which screens? Nothing in the sweep is missing or broken for the 7 standard roles                                                                                                             | No specific screen was named                                                 |
| Q5  | Lead **stages, owner and follow-up** (only open, converted and archived exist today)                                                                                                                                               | Gap review G-12                                                              |
| Q6  | Menu rules for **custom roles** (Integrations, Onboarding, Staff bulk; system roles unaffected)                                                                                                                                    | PERM-01 to 03, low                                                           |
