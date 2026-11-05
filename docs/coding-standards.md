# Coding standards

These are the conventions the code already follows, each with a place where you can see it. If
the code disagrees with this page, the code wins. In that case, fix this page or raise a ticket.
For UI patterns, see [ui-standards.md](ui-standards.md).

## 1. Files and naming

| Kind                       | Convention                                                                                                                                  | Evidence                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Component                  | `PascalCase.tsx`, one main component per file, **named export**                                                                             | `src/components/ui/DataTable.tsx`, `features/jobs/components/JobFormPanel.tsx`        |
| Page                       | `features/<f>/pages/<Name>Page.tsx`, **default export**, loaded lazily by the router                                                        | 97 of the 97 `*Page.tsx` files have a default export (`pageLoaders.ts`)               |
| Sidebar layout of a module | `<Feature>LayoutPage.tsx`, which renders `ModuleSidebarLayout`                                                                              | `features/billing/pages/BillingLayoutPage.tsx`                                        |
| Hook                       | `useThing.ts` (or `.tsx` when it returns JSX)                                                                                               | `src/hooks/useDebouncedValue.ts`, `features/clients/workspace/useClientLifecycle.tsx` |
| API module                 | `<feature>Api.ts` or `<area>.ts`, plus `keys.ts`, `invalidation.ts` and `pages.ts` in `api/`                                                | `features/billing/api/`                                                               |
| Status and label maps      | `constants.ts`, as `Record<Status, { label, tone }>`                                                                                        | `features/jobs/constants.ts` (`JOB_STATUS_META`)                                      |
| Types                      | `types.ts` per feature. Shared types go in `src/types`                                                                                      | `src/types/api.ts` (`Pence`, `Minutes`, `BasisPoints`, `PageMeta`)                    |
| Tests                      | Next to the code they test: `X.test.tsx`. Mandatory-field tests are `*.required.test.tsx`. Fixtures and handlers go in `features/<f>/test/` | `features/tickets/test/required.required.test.tsx`                                    |
| Other default exports      | Only the lazily loaded chart implementations                                                                                                | `src/components/charts/impl/*Impl.tsx`                                                |

## 2. Imports

- **Alias.** `@/` means `src/` (`vite.config.ts` `resolve.alias`, `tsconfig.app.json` `paths`).
  Use it across folders, and relative paths (`../api/keys`) inside a feature.
- **Order.** External packages, a blank line, `@/…`, a blank line, then relative imports. Every
  file shows this, for example `src/app/router/guards.tsx`.
- **Type imports.** Enforced by `@typescript-eslint/consistent-type-imports` with
  `fixStyle: 'inline-type-imports'`, which gives `import { api, type ApiResult } from '@/services/api'`.
  `verbatimModuleSyntax` is on.
- **Boundaries.** Enforced by `eslint.config.js`:
  - `components/ui` imports nothing from features, pages, services, app, layout or forms.
  - `components/**` imports no features or pages.
  - Features import no pages and no app wiring, and use other features only through
    `@/features/<x>` (their `index.ts`).
  - Services, utils, constants, types and hooks import no UI.
  - Tests and `src/test/**` are exempt.
- **zod.** Import it as `import * as z from 'zod'` (29 of 29 runtime imports).

## 3. TypeScript

- `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`,
  `noImplicitOverride` and `erasableSyntaxOnly` are on (`tsconfig.app.json`). The last one
  forbids `enum` and namespaces, so use `as const` arrays and maps instead, as
  `RATE_MODES` in `src/types/organization.ts` does.
- ESLint is `strictTypeChecked`. `no-explicit-any` is an error, and template literals accept only
  strings and numbers. That is why the code writes `` `${String(count)}` `` for other values
  (`features/jobs/schemas/job.ts`).
- **Units:** money is integer pence (`Pence`), time is minutes (`Minutes`), VAT and mark-ups are
  basis points (`BasisPoints`).
  - Convert only with `src/utils/money.ts` (`formatMoney`, `parsePounds`, `penceToPoundsInput`) and
    `src/utils/minutes.ts` (`formatMinutes`, `parseMinutes`).
  - `parsePounds` never uses `parseFloat` (README).
- **API calls** are typed generics, for example `api.get<InvoiceDetail>(…)` and
  `api.list<Item>(…)`. List hooks read `meta.next_cursor`.
- **Permissions** are typed: `PermissionCode` and `PERMISSIONS` from `src/constants/permissions.ts`.

## 4. Hooks and data

- Data hooks live in `features/<f>/api/`.
  - They take `organization.id` from `useOrg()`.
  - Keys come from the feature's `keys.ts`, extending `queryKeys.org.*`.
  - Mutations call the feature's invalidation helper in `onSettled`, for example `useCreateJob`
    in `features/jobs/api/hooks.ts`.
- **List state** lives in the URL: `useUrlParams` (`src/hooks/useUrlParams.ts`) and the feature
  `useUrlSearch`.
- **zustand** is only for preferences and shell state. Server data always goes through
  TanStack Query (README "Stack", `src/app/store`).
- **`localStorage` and `sessionStorage`** are accessed only through guarded helpers wrapped in
  try/catch (`clients/store.ts` `guardedStorage`, `hooks/usePersistentColumns.ts`). An ESLint rule
  forbids bare `localStorage.` and `sessionStorage.`.
- **`eslint-disable`** is rare and always targeted. The most common is
  `react-hooks/exhaustive-deps` (9 occurrences), each with a comment explaining why, as in
  `features/billing/hooks/useUrlSearch.ts`.

## 5. Styling

- **Tailwind utilities** generated from the tokens in `src/styles/theme.css`, for example
  `bg-brand`, `text-text-muted`, `border-row-border` and `bg-badge-red-soft`. The same tokens are
  redefined under `:root[data-theme='dark']`.
- **Never write raw hex in TSX.** The exceptions found are in §3.9 of ui-standards.
- **Join class names with `cn()`** from `src/utils/cn.ts`, which skips falsy values. There is no
  `clsx` or `tailwind-merge`.
- **Write Tailwind class names out in full** so the scanner finds them, as the
  `ROW_ACTION_CLASSES` comment in `components/ui/rowActionIcon.ts` explains.
- **Router links that look like buttons** use `buttonClasses({ variant })`.
- **Feature CSS files.** There is only one, `src/styles/capium-clients.css`, for the Clients list.
  It is a known deviation (ui-standards §3.1), and new screens should not copy it.
- **Breakpoints.** Controls are 44 px below `md` and 29 px from `md`. Navigation switches at
  `lg` (`buttonStyles.ts`, `AppShell.tsx`).

## 6. Accessibility

| Rule                                                                       | Evidence                                                                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every table has a name                                                     | `DataTable` and `Table` require `caption` (rendered visually hidden)                                                                                        |
| Icon-only buttons have `aria-label`, and the icon has `aria-hidden="true"` | `RowActions.tsx`, `SearchField.tsx` ("Clear search")                                                                                                        |
| A row's actions form a named group                                         | `RowActions` `role="group" aria-label="Actions for …"`. Tests rely on it (`src/test/rowActions.ts`)                                                         |
| Inputs have a label. A placeholder is not a label                          | `Input` and `Select` require `label`, `SearchField` requires `label` ("the placeholder is not a label")                                                     |
| Required fields carry `aria-required` and the star                         | `Input` `required`, `Field` `required`, `src/test/requiredFields.ts`                                                                                        |
| Dialogs trap focus, close on Escape and return focus                       | `Modal.tsx`, `Sheet.tsx`, `useFocusTrap.ts`                                                                                                                 |
| Busy and live states are announced                                         | `Button loading` sets `aria-busy`; `BulkBar` has `announcement`; `tickets/components/LiveRegion.tsx`; Central banner `role="status"` (design/client-360.md) |
| Sort headers expose `aria-sort`                                            | `Table.tsx` `ariaSort`, `DataTable.tsx`                                                                                                                     |
| Colour is never the only signal                                            | Badges always show their text (`jobs/constants.ts`: "never colour alone"). Filter counts have `sr-only` text (`FilterPopover.tsx`)                          |
| Reduced motion is respected                                                | `MotionConfig reducedMotion="user"` (`AppProviders.tsx`), `hooks/useReducedMotion.ts`                                                                       |

No ESLint accessibility plugin is configured (`eslint.config.js`, `package.json`). These rules
are kept by review and by the role-based queries in the tests.

## 7. Copy and wording

- **UK English:** "ageing", "finalise", "colour", "practice" (never "organization" in copy). A
  scan of string literals in the features found no US spellings in user-facing copy.
- **"Practice", not "organization"**, in everything the user sees. Code identifiers keep
  `organization`.
- **Sentence case** for buttons, dialog titles, toasts and messages, for example "Create invoice",
  "Clear filters" and "Delete this time entry?". Navigation labels in `navigation.ts` are Title
  Case ("Client List", "Expense Claims"). Page titles are mixed (ui-standards §3.9).
- **Validation messages** are imperative and specific: "Enter the name of the job", "Choose the
  client", "Use at most 200 characters" (`features/jobs/schemas/job.ts`).
- **Error toast titles** start with "Could not …" (33 occurrences). Success titles are past tense
  ("… added").
- **Ellipsis:**
  - Use the Unicode "…", not "...". There is one ASCII exception, in `TicketsToolbar.tsx`.
  - Use it for work in progress ("Downloading…") and for menu items that open a dialog.
  - **Don't use it in icon-button tooltips** or row-action labels (APT78).
- **Formats:** dates `dd/MM/yyyy`, money `£1,234.56` (`formatMoney`), hours `h:mm`
  (`formatMinutes`). See design/client-360.md and README "Money, time and the API".
- **Empty states:** "No … yet" when nothing exists, and "No … match" with **Clear filters** when a
  filter hides everything (`InvoicesPage.tsx`).

## 8. Comments and docstrings

- Exported functions, components, props and constants carry a `/** … */` docstring. It says in
  plain English what the thing is for and why, for example the props in `DataTable.tsx` and the
  `useBranchesEnabled` docstring in `features/settings/api/branchHooks.ts`.
- Comments explain decisions and constraints, not mechanics. For example, in `routes.tsx`:
  "Route-relative: `..` leaves this route and lands on `/:orgSlug`".
- A comment may cite the ticket that set a rule, as in "(APT74)" (41 non-test files do). It may
  also cite the API doc, as in "`docs/modules/dashboard.md` of the API".
- Test names are full sentences about behaviour, for example "opens a client from the
  keyboard" (`Client360Page.test.tsx`).

## 9. Commit messages (`git log origin/main`)

| Kind                          | Form                                                       | Example                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| First commit of a ticket      | `Fix ticket APTnn: <outcome in plain words>`               | `Fix ticket APT58: the By item search box names what it searches`                                                                |
| Several tickets               | `Fix tickets APTnn and APTmm: …`                           | `Fix tickets APT77 and APT78: distinct staff action icons in fixed places, no "…" in action tooltips` (branch `jaasir-apt76-80`) |
| Follow-up for the same ticket | `APTnn: <outcome>`                                         | `APT74: branches are switched on, and kept on, only with an active branch`                                                       |
| Other changes                 | An imperative sentence in sentence case, with no full stop | `Colour row action icons by what they do`                                                                                        |

- The subject line describes the user-visible outcome, not the code.
- The body, when there is one, explains the problem as the tester saw it, what changed, and what
  deliberately did not change (see APT61).
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` when
  Claude contributed.
