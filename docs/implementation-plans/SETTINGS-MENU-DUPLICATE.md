# Settings left menu repeats its Practice items

Reported by Raj B on 6 Nov 2026 (screenshot: "left side menu duplicate"), with the request to
run a regression. No ticket number yet; rename this file when one is assigned.

## Requirement

The Settings left menu showed "Practice / General Settings / Practice Settings" four times. Each
page must appear once, and the menu must stay correct while moving between pages.

## Root cause

* `src/constants/navigation.ts`: the Settings pages had two separate runs of the group
  `Practice`: General Settings and Practice Settings, then Access control, then Branches,
  Client Segments and Services (Branches was added there by APT74 on 3 Nov 2026).
* `src/components/layout/Sidebar.tsx:118` keyed each run by its name alone
  (`key={group.name}`), so the two runs shared the key `Practice`. When the menu re-renders
  (after a page change, or once permissions load), React cannot tell the two runs apart and
  can leave extra copies behind.
* `src/components/layout/OverflowNav.tsx:128` had the same flaw in the narrow-screen "More"
  menu: both headings had the id `group-Practice`.
* `ModuleSidebar.tsx` already keyed by place and name, so it was not affected.

Display only: no data, API or database is involved.

## Fix (approved: "do the best")

1. `Sidebar.tsx`: key each run by place and name (`index:name`), as `ModuleSidebar` does.
2. `OverflowNav.tsx`: the heading id includes its place, so it is unique.

The menu order is unchanged. Moving Branches, Client Segments and Services up under the first
Practice heading was tried and dropped: the full suite showed it changes where Settings opens
for a role without `organization.read` (it led to Branches, a "No access" page, instead of
Lock Past Periods; `orgRouting.test.tsx`). So Settings keeps its two Practice headings.

Found, not changed: Branches and Client Segments carry no permission in `navigation.ts`, so a
role that can open Settings sees them in the menu even when their page refuses it.

## Screens affected

The left menu of every module (shared `Sidebar`); no order changes. The "More" menu of modules
with grouped pages (Settings).

## Tests

* New in `Sidebar.test.tsx`: moving between Settings pages lists every link once, keeps the
  number of Practice headings, and logs no duplicate-key warning. It fails without the fix.
* Full UI suite, `tsc`, ESLint, Prettier, `npm run build`.
* Manual: every module's left menu in the local app, with no repeats and no console errors.

## Acceptance

Each Settings page appears once under one Practice heading, after any number of page changes,
and no module's menu repeats items.
