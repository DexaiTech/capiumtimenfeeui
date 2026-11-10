# UI standards

**Read this before any UI change.** Every screen should reuse the same building blocks in the same
way. This document has three parts:

1. A catalogue of the shared components in `src/components/ui` (and a few in `components/layout`
   and `components/forms`).
2. The app-wide patterns, each with its canonical implementation.
3. The **known inconsistencies**: places where screens do the same thing differently. These are
   the input for consistency tickets. None of them is fixed here.

Everything here was read from the code on `origin/main` as of 2026-11-05. Line numbers drift, so
search for the named symbol. Usage counts are the number of non-test `.tsx` files under
`src/features`, `src/components/layout`, `src/pages` and `src/app` that render the component.

## 1. Shared component catalogue (`src/components/ui`, exported from `index.ts`)

### Layout and containers

| Component                          | Purpose and key props                                                                                                                                                                                                                  | Use it when                                                                                            | Used in    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| `PageHeader` (`components/layout`) | `title`, `description`, `actions` (at most one primary)                                                                                                                                                                                | The heading of every page. Features wrap it in a `PageShell` (`features/<f>/components/PageShell.tsx`) | most pages |
| `Card`, `CardHeader`               | `variant` (`flat` (the default), `raised`, `gradient`), `padding`, `interactive`. `CardHeader` takes `title`, `description` and `actions`                                                                                              | Any white rounded block of content                                                                     | 91         |
| `FormSection`                      | Groups fields under a heading                                                                                                                                                                                                          | Long forms                                                                                             | 3          |
| `PageToolbar`                      | Slots `start` (count tabs or a title), `search`, `actions` (outline buttons) and `primaryAction` (the one solid violet button). Lays out by its own width (container `toolbar`): one row from 48rem, two rows below, stacked on phones | The toolbar of every list, passed as `DataTable toolbar`                                               | 56         |

### Data display

| Component                                                               | Purpose and key props                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Use it when                                                                                                                                                                                                         | Used in             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `DataTable`                                                             | Props: `columns` (`id`, `header`, `cell`, `sortable`, `sortValue`, `hideable`, `plain`, `align`), `rows`, `rowKey`, `caption` (required, screen-reader name), `selectable`, `selected`, `onSelectedChange`, `selectLabel`, `sort`, `onSortChange`, `hiddenColumns`, `rowActions`, `onRowClick`, `loading`, `empty`, `toolbar`, `footer`, `stickyHeader`. Plain text cells are styled automatically by `cellStyle.tsx` (`styleCell`): a column whose header looks like Status, Type, Segment and so on becomes a coloured pill (tone from `toneOfText`); a header like Manager or Partner gets an avatar; a header like Client gets the strong client name; amount columns are coloured green or red by meaning. Pass `plain: true` to opt out | **Every list or grid.** The canonical table                                                                                                                                                                         | 68                  |
| `Table`                                                                 | The older table. Below `md`, every row becomes a stacked card (`renderCard`). Has `expansion` (detail rows) and `layout="fixed"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Only where rows need expansion or a card layout on mobile (approval queues, the dashboard)                                                                                                                          | 12                  |
| `sortRows`                                                              | Client-side sort that uses `column.sortValue`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Lists that are loaded in full                                                                                                                                                                                       | —                   |
| `Pagination`                                                            | Cursor "Load more" with `hasMore`, `onLoadMore`, `loading`, `count`, `itemLabel`, `loadMoreLabel`, `endLabel`. Never page numbers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Every infinite list, inside `DataTable footer`                                                                                                                                                                      | 46                  |
| `Badge`                                                                 | Props: `tone` (`neutral`, `primary`, `success`, `warning`, `danger`, `info`, `orange`, `blue`, `red`, `amber`, `green`, `violet`, `grey`, `bronze`), `size` (`sm` or `md`), `dot`, `icon`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Statuses and categories. Always show the label as text, never colour alone. Features map statuses to tones in `constants.ts`, for example `jobs/constants.ts` `JOB_STATUS_META` and `billing/components/badges.tsx` | 88                  |
| `MoneyTone`, `moneyToneClass`                                           | Colours an amount by meaning (owed red, earned green)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Money cells outside `DataTable`'s auto-styling                                                                                                                                                                      | 25                  |
| `InitialsAvatar`, `PersonAvatar`, `Avatar`, `AvatarStack`, `ClientName` | Stable colour per id (`avatarColor.ts`), people and client names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | People and client cells                                                                                                                                                                                             | 11 / 3 / – / 0 / 11 |
| `HealthBar`, `ProgressBar`                                              | "84/100" with a coloured bar; progress with a tone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Health and budget figures                                                                                                                                                                                           | 2 / 9               |
| `RichText`, `RichTextEditor`                                            | Sanitised display and a TipTap editor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Ticket text and comments, email templates                                                                                                                                                                           | 2                   |
| `VirtualList`                                                           | Windowed list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Very long lists (no feature uses it yet)                                                                                                                                                                            | 0                   |

### Actions and menus

| Component                                              | Purpose and key props                                                                                                                                                                                                                                                                                                                                                                                                                                               | Use it when                                                                                                                                                                                | Used in                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `Button`, `buttonClasses`                              | `variant`: `primary` (solid violet, **one per screen**), `secondary` (the default) and `outline` (the same look), `brand-outline` (violet border, for Import and Export), `ghost`, `danger`. `size`: `sm`, `md`, `lg`, `icon`, `icon-sm`. Also `loading`, `leftIcon`, `rightIcon`, `compactLabel` (icon-only inside a `PageToolbar` narrower than 72rem; the label stays the accessible name and the `title`). `buttonClasses()` styles a router `Link` as a button | Every button. Never a raw `<button>` with hand-written classes                                                                                                                             | —                                  |
| `RowActions`                                           | `label` ("Actions for Acme Ltd", rendered as `role="group"`), `items: DropdownItem[]` (`id`, `label`, `onSelect`, `icon?`, `tone?`, `disabled?`), `status` (replaces the buttons while busy), `size` (`md` or `sm`). Each action is an icon button with `title` and `aria-label` set to the label                                                                                                                                                                   | **Every row's actions**, passed to `DataTable rowActions`. There is no three-dot menu (commit "Grid actions as icon buttons instead of the three-dot menu")                                | 39                                 |
| `rowActionIcon`, `rowActionColor` (`rowActionIcon.ts`) | Choose the icon and colour from the action's `id` and `label` by regex; the first matching rule wins                                                                                                                                                                                                                                                                                                                                                                | Leave `icon` unset so the rule decides. See §2.3                                                                                                                                           | —                                  |
| `Dropdown`                                             | A menu button with `trigger`, `label`, `items`, `align` and `header`                                                                                                                                                                                                                                                                                                                                                                                                | Page or header "More" menus (`InvoiceDetailPage`, `ClientHeader`, `StaffDetailPage`) and the user and practice menus                                                                       | 8                                  |
| `BulkBar`, `useBulkFlow`                               | A selection bar with `count`, `editOptions`, `onEdit`, `onDelete`, `limit` and `noun`                                                                                                                                                                                                                                                                                                                                                                               | Bulk edit or delete on a selectable `DataTable` (`clients/components/ClientsBulkBar.tsx`, `jobs/components/JobsBulkBar.tsx`, `TasksBulkBar.tsx`, `team/components/staff/StaffBulkBar.tsx`) | 4 (plus a tickets-local `BulkBar`) |
| `ColumnVisibilityMenu`                                 | The show/hide columns menu. Pair it with `usePersistentColumns(id)`                                                                                                                                                                                                                                                                                                                                                                                                 | Lists with hideable columns                                                                                                                                                                | 26                                 |
| `AddAnotherButton`, `useAddAnother`                    | Save the record and start the next one                                                                                                                                                                                                                                                                                                                                                                                                                              | Create forms that add many records                                                                                                                                                         | 4                                  |

### Overlays

| Component       | Purpose and key props                                                                                                                                                                                                            | Use it when                                                                                                          | Used in |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| `Modal`         | Props: `open`, `onClose`, `title`, `description`, `size` (`sm`, `md` or `lg`: `max-w-sm`, `max-w-lg` or `max-w-2xl`), `footer`, `closeOnBackdrop`, `dismissible`. Portal, focus trap, Escape to close. A bottom sheet below `md` | Short tasks and dialogs                                                                                              | 51      |
| `ConfirmDialog` | Props: `title`, a sentence or two as children, `confirmLabel`, `cancelLabel`, `tone` (`danger` by default, or `default`), `loading`, `confirmDisabled`, and `error` (shows a refusal in place)                                   | **Every confirmation.** Nothing uses `window.confirm`                                                                | 55      |
| `FormPanel`     | The same props as `Modal`, but rendered inline in the page flow, with no portal, backdrop or focus trap                                                                                                                          | Create and edit forms that sit above the list they edit                                                              | 33      |
| `Sheet`         | A full-height modal drawer. `label` is required; the content brings its own header and close button                                                                                                                              | Large side views (`time/components/HistoryDrawer.tsx`, `PersonSheetDrawer.tsx`, `team/.../StaffPermissionsCard.tsx`) | 3       |
| `Popover`       | Anchored, in a portal, flips and stays in the viewport. Props: `anchorRef`, `label`, `role`, `align`                                                                                                                             | Filter panels, export menus, small pickers                                                                           | 20      |
| `AnchoredPanel` | A `Popover` that stays open while nested pickers open their own portals                                                                                                                                                          | Forms with pickers inside a popover                                                                                  | 0       |
| `Tooltip`       | `content`, `side`. Wraps one focusable child and sets `aria-describedby`                                                                                                                                                         | Extra explanation on a control. Icon buttons in rows rely on the native `title` from `RowActions` instead            | 6       |

### Inputs and forms

| Component                                  | Purpose and key props                                                                                                                                                                                                                    | Used in           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `Input`                                    | `label` (required, can be hidden with `hideLabel`), `error`, `hint`, `required` (red star plus `aria-required`), `leftIcon`, `rightSlot`                                                                                                 | 73                |
| `Textarea`, `Select`, `Checkbox`, `Switch` | Same label, error and required pattern. `Select` is a styled native `<select>`                                                                                                                                                           | 39 / 85 / 30 / 13 |
| `Field`                                    | Wraps a custom control with a label, hint, error and required star (`field-required` in `styles/base.css`)                                                                                                                               | —                 |
| `DateField`, `DateRangeField`              | `YYYY-MM-DD` values. The range field has `presetsFrom` (this week, last month…), `weekStartsOn` and `endsToday`                                                                                                                          | 20 / 19           |
| `DurationInput`                            | Minutes typed as `h:mm` or decimal hours                                                                                                                                                                                                 | 3                 |
| `OptionPicker`                             | Single or multi select with search, `commitOnClose` and `onSearchChange` for server-side search                                                                                                                                          | 5                 |
| `SearchField`                              | Quick search: `value`, `onChange`, `label` (required), placeholder "Quick search" by default, a clear button, Escape to clear. 241 px, shrinks to 160 px in a one-row toolbar                                                            | 33                |
| `CountTabs`                                | Status tabs with counts ("Invoices 12"): `items` (`value`, `label`, `count`), `value`, `onChange`, `label`. When the tabs do not fit the strip scrolls, with a fade and an arrow on each hidden side, and keeps the selected tab in view | 34                |
| `Tabs`                                     | Section tabs (`role="tablist"`) with `idBase` for `aria-labelledby`                                                                                                                                                                      | 6                 |
| `SegmentedControl`                         | A small choice between views or modes, with `iconOnly`                                                                                                                                                                                   | 17                |
| `FilterBar`, `FilterChips`                 | Inline filters from `md` up, a sheet below; removable chips                                                                                                                                                                              | **0 (unused)**    |
| `FormAlert` (`components/forms`)           | Form-level error with the request ID                                                                                                                                                                                                     | —                 |
| `PasswordField` (`components/forms`)       | Password input with a show/hide toggle                                                                                                                                                                                                   | —                 |

### Feedback

| Component                   | Purpose and key props                                                                                             | Used in    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| `EmptyState`                | `icon`, `title`, `description`, `action` (only if the user may take it), `size` (`compact` or `page`)             | 98         |
| `ErrorState`                | `error` (message, request ID, code), `onRetry`, `retryLabel`, `retrying`. A permission error code is shown calmly | 39         |
| `Skeleton`, `Spinner`       | Content placeholders while loading; a spinner for inline busy states                                              | 63 / 11    |
| `ToastProvider`, `useToast` | `toast({ tone, title, description, action, duration })`                                                           | ~300 calls |

## 2. Application-wide patterns

### 2.1 List page layout and toolbar

The canonical example is `features/billing/pages/InvoicesPage.tsx`:

```
PageShell (PageHeader title + description)
└─ DataTable caption=… rows=… loading=… rowActions=(row ⇒ <RowActions …/>)
   ├─ toolbar = <PageToolbar
   │     start   = <CountTabs label=… items=[{value,label,count}] />
   │     search  = <SearchField label=… value={text} onChange={setText} />   (useUrlSearch)
   │     actions = <FilterPopover …/> <ColumnVisibilityMenu …/> Export (brand-outline)
   │     primaryAction = <Button variant="primary" size="sm" leftIcon=…>Create invoice</Button>  (only if can(...))
   ├─ empty   = filtered ? <EmptyState "No invoices match" + Clear filters> : <EmptyState "No invoices yet" + primary CTA>
   └─ footer  = <Pagination hasMore onLoadMore loading count itemLabel />
LoadError (feature PageShell.tsx) when the query fails; ConfirmDialog per destructive action
```

Other pages that follow it: `jobs/pages/JobsPage.tsx`, `billing/pages/CreditNotesPage.tsx`,
`settings/pages/VatCodesPage.tsx` and `expenses/pages/ExpenseClaimsPage.tsx`.

### 2.2 Data tables

- Use `DataTable` for every list. Always give it a `caption`.
- Search, filters and sort live in the URL. Hidden columns are remembered with
  `usePersistentColumns(id, initial)` (`src/hooks/usePersistentColumns.ts`).
- Let `styleCell` colour status and category columns. Write a `cell` that returns a `Badge` only
  when the feature has a label and tone map.
- `Table` is acceptable only where `DataTable` lacks something: expandable rows or the card
  layout below `md`.
- Raw `<table>` is acceptable for non-list layouts: the week grid
  (`time/components/timesheet/WeekGridTable.tsx`), the calendar, the invoice template preview and
  `components/charts/ChartTable.tsx`.

### 2.3 Row action icons

- Use `RowActions` inside `DataTable rowActions`.
- Give each action a meaningful `id` and a plain label ("Edit", "Delete", "Download PDF"). Leave
  `icon` unset so the rules in `rowActionIcon.ts` choose it:

| Meaning          | Words matched (id or label)                                                                                                 | Icon                                                                             | Colour |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Look             | view, open, see, show, preview, details · download, pdf, export, statement · send, submit · sync, refresh · link, go to     | `Eye` · `Download` · `Send` · `RefreshCw` · `ExternalLink`                       | blue   |
| Change           | edit, rename, change, update, manage · correct · settings · reset, password · assign, add                                   | `Pencil` · `PencilLine` · `Settings2` · `KeyRound` · `UserPlus`                  | violet |
| Done             | approve, accept, confirm, mark paid/done · issue, finalise · record payment · activate · restore, unarchive                 | `CircleCheck` · `FileCheck` · `Banknote` · `UserCheck` · `ArchiveRestore`        | green  |
| History and undo | history, audit, timeline · record time, log time · default · reopen · recall, undo, return, reverse, revoke · remind, email | `History` · `Clock` · `Star` · `RotateCcw` · `Undo2` · `Mail`                    | amber  |
| Caution          | archive · end date · credit note · transfer, move · attach, receipt, file · duplicate, copy                                 | `Archive` · `CalendarX` · `FileMinus2` · `ArrowLeftRight` · `Paperclip` · `Copy` | orange |
| Risky            | delete, remove, discard · void, cancel, disable · reject, decline · deactivate, suspend                                     | `Trash2` · `Ban` · `CircleX` · `UserX`                                           | red    |

- **Staff sign-in actions come first (APT77).** These rules sit at the top of `RULES`, so they
  win over the general ones above: Unlink login → `Unlink` (orange), Link login → `Link` (blue),
  Invite / Resend invitation → `MailPlus` (blue), Change role → `ShieldCheck` (violet). Keep labels
  of other grids clear of these words (e.g. a "Delete role" would get the shield).
- **Rule order matters.** For example, "Unarchive" must match restore before archive.
- **Overrides.** `tone: 'danger'` forces red. An `icon` override changes only the icon: the colour
  still comes from the words, so the two can disagree (§3.2).
- **Tooltips** use the action label, through native `title` and `aria-label`. `RowActions` strips a
  trailing "…" (or "...") from them (APT78), so a menu label like "Issue…" shows as "Issue" on the
  icon. The ellipsis belongs to menu items that open a dialog, not to icon buttons.
- **Fixed positions (APT77).** Pass `slots` so each action stays in the same column on every row:
  - `RowActions` `slots`: an ordered list of action ids; a nested list holds ids that never show
    together (they share one place). An empty place is an `aria-hidden` spacer, not a button. An
    action without a place, or whose shared place another action took, follows at the end, so no
    action is ever hidden.
  - `slotsInUse(slots, rows)` (`rowActionSlots.ts`) drops the places no row of the list uses, so
    a grid is not widened by empty gaps.
  - In use: `STAFF_ACTION_SLOTS` (`team/hooks/useStaffActions.tsx`, with `slotsInUse`) and
    `INVOICE_ACTION_SLOTS` (`billing/pages/InvoicesPage.tsx`). Other grids don't pass `slots`
    yet; add them when a grid's rows have different action sets.

- **Tests.** Use `src/test/rowActions.ts`: `rowAction('Actions for Acme', 'Edit')`.

### 2.4 Dropdowns and menus

| Need                                       | Use                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Row actions                                | `RowActions` (no menu)                                                                                                                                                               |
| A "More" menu on a page or header          | `Dropdown`                                                                                                                                                                           |
| Filters                                    | The feature's `FilterPopover`: an outline "Filter" button with a count bubble, then a `Popover` with a footer of "Clear filters" and "Done". Seven copies exist (§3.4)               |
| Export menu                                | `Popover` with menu items (`features/{audit,reports,wip}/components/ExportMenu.tsx`, `time/components/analysis/ExportMenu.tsx`). Single-format exports use a `brand-outline` button  |
| Choosing one value from a short fixed list | `Select`                                                                                                                                                                             |
| Choosing from a long or searchable list    | `OptionPicker`, or the async pickers: `ClientPicker` (`features/clients`), `StaffPicker`, `JobPicker` and `ClientPicker` (`features/team`), and `MemberPicker` (`features/settings`) |

### 2.5 Modals, dialogs and confirmations

- **Modal footers** use `DialogActions` (copied into each feature's `components/DialogActions.tsx`).
  It is sticky at the bottom, and is `flex-col-reverse sm:flex-row sm:justify-end`.
  - Put **Cancel first in the markup, then the primary button.** Cancel then sits on the left and
    the primary button on the right, and on phones the primary button sits on top.
  - Use `Modal footer` when the dialog has no scrolling form.
- **Confirmations** always use `ConfirmDialog`:
  - The title is a question ending in "?" ("Delete this time entry?").
  - The body is a sentence or two on the consequence. Add "This cannot be undone." for deletes.
  - `confirmLabel` is verb plus noun ("Delete entry", "Void invoice").
  - Use `tone="default"` for reversible actions such as archive.
  - Show a refusal from the API with `error={dialogError(err)}`, so the dialog stays open.
- **Modal vs FormPanel vs Sheet:**
  - `Modal` is for short, focused tasks and confirmations.
  - `FormPanel` is for create and edit forms of list records, with the list still visible.
  - `Sheet` is for large side views (history, a person's week).

### 2.6 Side panels and popovers

- **`FormPanel`** opens inline above the list. Its footer is `DialogActions` or the `footer`
  prop.
- **`Sheet`** sets its own width through `className` (`max-w-lg` to `max-w-5xl` today).
- **`Popover`** closes on Escape, an outside press or scrolling. Use `AnchoredPanel` when the
  popover contains pickers.

### 2.7 Filters and filter sets

- **Canonical.** A feature `FilterPopover` holds `Select`, `DateRangeField` and picker fields.
  The active filters are counted on the button and stored in the URL.
  - With a filter active and nothing found, show `EmptyState` "No … match" with **Clear filters**.
  - With no filter, show "No … yet".
- **Saved filter sets** exist only on the Clients list (`clients/components/FilterSetMenu.tsx`,
  stored per practice in `clients/store.ts`).
- **The shared `FilterBar` and `FilterChips` are unused.**

### 2.8 Search fields

- Use `SearchField` in `PageToolbar search`, with a `label` such as "Search invoices".
- Debounce through the feature's `useUrlSearch` (300 ms, trimmed, written to `?q=`), for
  example `billing/hooks/useUrlSearch.ts`.
- **Placeholders.** The default is "Quick search". Otherwise name what is searched
  ("Search number or client"). Commit 69ef80b, "Fix ticket APT58: the By item search box names
  what it searches", set the direction: say what the box searches.
- Async pickers debounce for 250 ms (`clients/picker/ClientPicker.tsx`).

### 2.9 Tabs

| Purpose                                                    | Component                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Status or sub-list tabs with counts on a list              | `CountTabs`, in `PageToolbar start`                                                 |
| Sections of one page or record                             | `Tabs`. The client workspace uses `CountTabs` in `clients/workspace/ClientTabs.tsx` |
| A small view or mode switch (list/grid, debtors/reminders) | `SegmentedControl`                                                                  |

### 2.10 Empty, loading and error states

| State         | Inside a `DataTable`                                                                                                                | Whole page or card                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Loading       | `loading` (skeleton rows)                                                                                                           | `Skeleton` blocks. `Spinner` only for small inline waits |
| Empty         | `empty={<EmptyState …/>}`                                                                                                           | `<Card><EmptyState size="page" …/></Card>`               |
| Error         | Above the table: the feature's `LoadError` (`ErrorState` in a card, with the request ID and **Try again**)                          | `ErrorState`                                             |
| No permission | The router shows `NoAccessPage` (`app/router/guards.tsx`). In a page, the feature's `NoAccess` (`billing/components/PageShell.tsx`) | —                                                        |

### 2.11 Forms and validation

- **Library.** react-hook-form with `zodResolver`, using a schema from `features/<f>/schemas/*.ts`
  (`import * as z from 'zod'`).
- **Schema style:**
  - Money is typed in pounds as a string and converted with `parsePounds` (`utils/money.ts`).
  - Durations are minutes.
  - Empty means "none" (see `jobs/schemas/job.ts`).
- **Messages** are imperative and specific: "Enter the name of the job", "Choose the client",
  "Use at most 200 characters". `.min(1, 'Enter …')` appears about 32 times and
  `.min(1, 'Choose …')` about 23 times.
- **Field errors** go through the control's `error` prop (`Field.tsx`). Never use a hand-written
  `<p className="text-danger">`.
- **Server errors** go through `useSubmitError({ setError, fields })`, then `FormAlert` above the
  footer. See [architecture.md](architecture.md) §9.
- **Required fields** use the `required` prop, which draws the red star (`.field-required::after`)
  and sets `aria-required`. Don't add "(optional)" as well. Assert required fields in tests with
  `expectRequiredFields` (`src/test/requiredFields.ts`).
- **Submit labels.** "Add <thing>" or "Save <thing>" are the most common. Page-level create
  buttons are inconsistent (§3.6).
- **Unsaved changes.** Use `useBlocker` or `useBeforeUnload` (`features/settings/hooks`).

### 2.12 Notifications and toasts

- Use `useToast` for outcomes:
  - **Success:** sentence case, past tense, naming the object (`` `${name} added` ``).
  - **Failure:** `tone: 'error'`, a "Could not …" title, and the server message as the
    description.
- Use a toast `action` for a follow-up, such as **Open client**
  (`clients/central/CentralClientsDialog.tsx`).
- Inline, persistent notices currently have no shared component (§3.7).

### 2.13 Buttons and colours

- Use one `primary` button per screen. An `EmptyState` call to action may repeat it.
- Import and Export use `brand-outline`. Other toolbar buttons (Filter, Columns) use `outline` and
  `size="sm"`.
- Use `danger` only in confirmations.
- Colours come from tokens only (`src/styles/theme.css`, light and dark), never raw hex in TSX.

### 2.14 Badges and status pills

- Use `Badge` with a tone from the feature's status map (`STATUS_META` or `*_STATUS_LABELS`).
  Use `dot` for statuses.
- A status that appears in more than one feature should share one map: import it from the owning
  feature's `index.ts`, for example `BILLING_STATUS_META` from `features/expenses`.

### 2.15 Permissions in the UI

- **Hide** actions the role cannot take: `can(PERMISSIONS.x) ? <Button/> : undefined`, or `<Can>`.
  `InvoicesPage` `primaryAction` and the README's "Adding a feature page" step 3 both do this.
  Whether any screen disables an action for a permission reason instead was not checked
  across the app (unverified).
- Whole pages are gated by the route (`RequireAccess`).
- Pages also show the feature `NoAccess` when their endpoint needs a permission the page rule
  doesn't cover.
- Practice toggles (branches, segments, Central, approvals) hide whole elements. See
  [architecture.md](architecture.md) §8.

### 2.16 Responsive behaviour

| Element                             | Behaviour                                                                                                                                                  | Source                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Controls                            | 44 px tall below `md` (touch), 29 px from `md`                                                                                                             | `buttonStyles.ts`, `SearchField.tsx` |
| `Modal`                             | Bottom sheet below `md`, centred from `md`                                                                                                                 | `Modal.tsx`                          |
| `DataTable`                         | Scrolls sideways on narrow screens                                                                                                                         | `DataTable.tsx`                      |
| `Table`                             | Stacked cards below `md`                                                                                                                                   | `Table.tsx` (`DESKTOP_QUERY`)        |
| Navigation                          | Sidebar from `lg`. Below `lg`, a top-bar drawer plus `SubNav`                                                                                              | `components/layout/AppShell.tsx`     |
| `Toast`                             | Top centre on mobile, bottom-right from `md`                                                                                                               | `Toast.tsx`                          |
| `SearchField`                       | Full width below `sm`, 241 px from `sm`; shrinks to 160 px in a one-row toolbar                                                                            | `SearchField.tsx`                    |
| `PageToolbar`                       | By the toolbar's own width (container query): one row from 48rem (tabs scroll, search shrinks); below it tabs, then search and actions; stacked below `sm` | `PageToolbar.tsx`, `CountTabs.tsx`   |
| Toolbar buttons with `compactLabel` | Icon-only with a `title` when the toolbar is narrower than 72rem: Show/Hide Columns and Export. Filter and the primary button keep their labels            | `Button.tsx`                         |

## 3. Known inconsistencies

Each item gives the file references, then the variant that looks canonical. Nothing here has
been fixed.

### 3.1 Tables and grids

- **The Clients list is its own system:**
  - `clients/components/ClientsTable.tsx` (~l.148) is a raw `<table className="cc-table">`.
    `ClientsGrid.tsx` is a second custom view.
  - Both are styled by `src/styles/capium-clients.css`: 1,532 lines, 39 raw hex values, and its
    own `cc-btn`, `cc-menu`, `cc-select`, `cc-skeleton` and `cc-state` classes. It is imported
    only by `clients/pages/ClientsPage.tsx`.
  - The sister page `clients/pages/LeadsPage.tsx` uses `DataTable`.
  - Canonical: `DataTable`.
- **Approval queues use `Table`, their siblings `DataTable`:**
  - `expenses/pages/ExpenseApprovalsPage.tsx` and `time/pages/TimesheetApprovalsPage.tsx` use
    `Table`.
  - `ExpenseClaimsPage.tsx` and `TimeEntriesPage.tsx` use `DataTable`.
- **Raw `<table>` for record lines and lists**, styled with three ad-hoc Tailwind recipes:
  - `billing/components/AllocationGrid.tsx`, `CreditNotePanel.tsx`,
    `creditNotes/CreditNoteDetailDialog.tsx`, `invoice/InvoiceInfoCards.tsx`,
    `estimates/EstimateDetailDialog.tsx`, `recurring/ScheduleDetailDialog.tsx`
  - `team/pages/StaffDetailPage.tsx`
  - `notifications/components/settings/ChannelMatrix.tsx`
  - `tickets/components/dashboard/RecentTicketsCard.tsx`
  - `expenses/components/ReviewLines.tsx`
  - `audit/components/ChangesTable.tsx`
  - `time/components/approvals/SheetEntries.tsx`

  Estimate and schedule lines are raw tables, while invoice lines (`invoice/InvoiceLinesCard.tsx`)
  use `DataTable`.

- **Column menus.** Clients has its own `clients/components/ColumnsMenu.tsx`. Elsewhere, 26 files
  use `ColumnVisibilityMenu`.
- **The client import error table** (`clients/components/ImportDialog.tsx`) is a raw table, while
  the Settings import dialogs use `DataTable`.

### 3.2 Row actions: same action, different icon or colour

- **Open/View.**
  - `ExternalLink`: `jobs/pages/JobsPage.tsx` (~l.141), `expenses/pages/ExpenseClaimsPage.tsx`
    (~l.185), `MyExpensesPage.tsx`, `reports/components/ReportScreen.tsx`.
  - The rule's `Eye`: `billing/pages/InvoicesPage.tsx`, `tickets/components/list/TicketsTable.tsx`,
    `clients/pages/ClientsPage.tsx`, `wip/pages/WipTransfersPage.tsx`.
  - The labels also vary: "Open", "View", "Details", "Open client", "Open the client".
- **View statement.** `Banknote` in `billing/components/debtors/DebtorsView.tsx` (~l.141; the
  colour comes out blue) vs `FileText` in `statements/StatementsView.tsx` (~l.146).
- **Return.** `Redo2` in `ExpenseClaimsPage.tsx` (~l.202) and `ExpenseApprovalsPage.tsx`, vs
  `Undo2` in `TimesheetApprovalsPage.tsx` (~l.179) and in the rule.
- **Correct.** `Wrench` in `time/pages/TimeEntriesPage.tsx` (~l.388) and `Pencil` in
  `expenses/components/LinesTable.tsx`, vs the rule's `PencilLine`.
- **Download PDF.** The rule's `Download` in `InvoicesPage` and `CreditNotesPage`, vs `FileDown`
  in `invoice/InvoiceInfoCards.tsx` (~l.280), `InvoiceDetailPage.tsx`,
  `CreditNoteDetailDialog.tsx` and `clients/workspace/tabs/InvoicesTab.tsx`.
- **Approve/Reject.** `Check` and `X` in `wip/components/AdjustmentsView.tsx`, vs the rule's
  `CircleCheck` and `CircleX`.
- **Activate/Deactivate.**
  - `Power` in `expenses/pages/ExpenseTypesPage.tsx`.
  - The person icons (`UserX`, `UserCheck`) on non-person records: `team/pages/ActivityTypesPage.tsx`,
    `GradesPage.tsx`, `ServicesPage.tsx`, `settings/pages/InvoiceTemplatesPage.tsx`.
- **Record time.** `Plus` in `time/pages/TeamTimesheetsPage.tsx`, drawn amber because the colour
  comes from the words.
- **Reverse.** Forced red (`tone: 'danger'`) in `AdjustmentsView.tsx`, `WriteOffsView.tsx` and
  `WipTransfersPage.tsx`, while the rule gives amber `Undo2`.
- **Hand-rolled icon buttons instead of `RowActions`** (ghost buttons, no colour, no `title`):
  `clients/workspace/settings/RatesCard.tsx`, `ServicesCard.tsx`,
  `clients/workspace/tabs/ContactsTab.tsx`, and `expenses/components/receipts/ReceiptsDialog.tsx`.
- **Approve and Return as text buttons:**
  - `ExpenseApprovalsPage.tsx`: Return comes first, as an outline button.
  - `TimesheetApprovalsPage.tsx`: Approve comes first.
- **Trailing "…" in action labels.** `billing/pages/InvoicesPage.tsx` `actionsFor` still labels
  "Issue…", "Send email…", "Void invoice…"; since APT78 `RowActions` strips the "…" on the icon,
  so the tooltip is right, but the labels themselves keep it (fine for menus).
- **Canonical:** the rule icon and colour, with no `icon` override unless the rule is missing a
  word. In that case, add the word to `rowActionIcon.ts`.

### 3.3 Search

- **Custom search inputs:**
  - `clients/components/ClientsToolbar.tsx` (`cc-search`, no clear button).
  - `tickets/components/list/TicketsToolbar.tsx` (~l.106): a raw `<input type="search">` with no
    clear button and an ASCII "..." placeholder.
  - `clients/central/CentralSearch.tsx` and `settings/components/roles/PermissionPicker.tsx` use
    `Input type="search"`.
- **Duplicated `useUrlSearch`.** It is copied in billing, expenses, jobs, settings, team, wip and
  `clients/workspace/records/urlFilters.ts`.
- **No debounce** in `billing/components/prepare/BillingSummary.tsx` or `PermissionPicker`.
- **Placeholder styles are mixed:**
  - "Quick search", used in about 15 files.
  - "Search …" phrases, such as "Search number or client".
  - Bare noun lists, such as "Name, number or client" (`JobsPage`).
- **Canonical:** `SearchField` with the debounced `useUrlSearch`.

### 3.4 Filters

- **The shared `FilterBar` and `FilterChips` have 0 call sites.** Instead, `FilterPopover.tsx` is
  copied into billing, expenses, jobs, reports, team, time and wip. The copies differ only in
  comments.
- **Clients** has its own `FilterPanel.tsx` (native `<select className="cc-select">`) and the only
  saved filter sets (`FilterSetMenu.tsx`).
- **Tickets** has a local `FilterPicker` built on `OptionPicker` (`TicketsToolbar.tsx`).
- **Inline `Select` filters with no popover:** the client workspace tabs (`TimeTab.tsx`,
  `ExpensesTab.tsx`, `PaymentsTab.tsx`…), `LeadsPage.tsx` and `AuditLogSettingsPage.tsx`.
- **Popover titles vary:** "Filter the debtors" vs "Filter invoices".
- **Canonical:** the `FilterPopover` pattern. It should move into `components/ui`, or be replaced
  by `FilterBar`. That is a decision for a ticket.

### 3.5 Tabs

- `clients/components/ClientsToolbar.tsx` (~l.73) builds a custom `cc-tabswitch` for
  Clients/Leads, while `LeadsPage` uses `CountTabs`.
- `dashboard/pages/DashboardPendingApprovalsPage.tsx` uses `Tabs` with the count in the label
  ("All (N)") instead of `CountTabs`.
- Sub-list switching is done three ways:
  - `SegmentedControl`: `billing/pages/DebtorsPage.tsx`, `wip/pages/WipAdjustmentsPage.tsx`.
  - `Tabs`: `settings/components/importExport/ImportExportView.tsx`,
    `integrations/IntegrationsView.tsx`.
  - `CountTabs`: `clients/workspace/ClientTabs.tsx`.

### 3.6 Modals, confirmations, forms

- **Reversed footer order.** `tickets/components/list/CreateTicketPanel.tsx` (~l.295) puts
  **Submit** before **Cancel**, so the primary button lands on the left. Its panel title is
  "Application Testing" and its submit label is "Submit", where other forms use "Add …".
- **Local `ConfirmDialog` fork.** `settings/components/ConfirmDialog.tsx` has no `cancelLabel` and
  no `error.items`, and is used only by `settings/components/roles/DeleteRoleDialog.tsx`.
- **Confirmations built by hand on `Modal`:**
  - `team/components/staff/DeactivateStaffDialog.tsx`
  - `account/components/LogoutEverywhere.tsx`
  - `organizations/components/DeleteOrganization.tsx` (type-to-confirm)
  - an inline delete view in `expenses/components/receipts/ReceiptsDialog.tsx`
- **Three `ReasonDialog`s:**
  - `billing/components/ReasonDialog.tsx`: Modal with react-hook-form.
  - `time/components/ReasonDialog.tsx`: Modal.
  - `wip/components/ReasonDialog.tsx`: wraps `ConfirmDialog`.
- **Two client import dialogs:** `clients/components/ImportDialog.tsx` and
  `settings/components/importExport/ClientsImportDialog.tsx`.
- **Confirmation wording:**
  - The clients screens (`ClientsPage.tsx`, `RatesCard.tsx`, `ServicesCard.tsx`, `ContactsTab.tsx`)
    use titles with no "?".
  - The confirm label varies between a bare "Delete" and "Delete <noun>".
  - Time uses "Delete this time?" (`WeekView.tsx`) and also "Delete this time entry?"
    (`DayView.tsx`, `TimeEntriesPage.tsx`).
  - Archive uses `tone="default"`, while Deactivate stays red.
- **"Close" button variant.** Primary in `ReceiptPreview.tsx`, `AttachmentPreview.tsx` and
  `CopyWeekDialog.tsx`; secondary in `EstimateDetailDialog.tsx`, `PaymentDetailDialog.tsx` and
  `CreditNoteDetailDialog.tsx`.
- **Footers.** `DialogActions` is copied into 8 features (7 byte-identical). The six client
  `FormPanel`s hand-roll their footers (`ClientFormPanel.tsx`, `ContactFormPanel.tsx`,
  `EngagementFormPanel.tsx`, `leads/LeadFormPanel.tsx`, `ClientRatePanels.tsx`,
  `JobRatePanel.tsx`).
- **Forms without react-hook-form:**
  - `clients/workspace/tabs/JobRatePanel.tsx`
  - `time/components/timesheet/CopyEntryDialog.tsx`, `CopyWeekDialog.tsx`, `TimerCard.tsx`
  - `jobs/components/TasksBulkAddForm.tsx`
  - the notifications settings and templates, which report save failures by toast instead of
    `FormAlert`
- **Hand-written `<p role="alert" className="text-danger">` errors:** `billing/components/LineGrid.tsx`,
  `statements/StatementDialog.tsx`, `time/components/timesheet/TimerCard.tsx`,
  `wip/components/TransferDialog.tsx`, `expenses/components/LineFormPanel.tsx`.
- **"(optional)" next to `required` stars:** `billing/components/estimates/EstimateFormPanel.tsx`,
  `recurring/ScheduleFormPanel.tsx`.
- **Create labels.** "New …" in expenses, jobs, estimates and roles; "Add …" in settings, team,
  clients and leads; "Create" in `JobFormPanel` and `RoleEditor`.
- **Canonical:** `ConfirmDialog`, `DialogActions` with Cancel first, react-hook-form with
  `useSubmitError` and `FormAlert`, and sentence-case "Add <thing>".

### 3.7 Pickers, menus, notices, toasts

- **Two `ClientPicker`s:** `clients/picker/ClientPicker.tsx` and
  `team/components/pickers/ClientPicker.tsx`.
  - Billing uses both. `billing/components/BalanceFilterFields.tsx` and
    `debtors/ReminderLogView.tsx` import the team one.
  - Each picker is a copy-pasted combobox, as is `settings/components/MemberPicker.tsx`.
- **Choosing staff** is done four ways: `StaffPicker`, `MemberPicker`, the `OptionPicker`
  `AssigneePicker`, and a native `Select` (`jobs/pages/JobsPage.tsx`,
  `wip/components/WipFilterFields.tsx`).
- **Two bulk bars.** `tickets/components/list/BulkBar.tsx` (used by
  `tickets/pages/TicketsListPage.tsx`) shadows the name of the shared `BulkBar`. Clients uses the
  shared `BulkBar` (`ClientsBulkBar.tsx`) and also a `cc-menu` `BulkActionsMenu.tsx` in its toolbar.
- **No shared inline notice.**
  - `time/components/Notice.tsx` and `organizations/components/ApprovalOffNotice.tsx` exist.
  - Other screens hand-roll `bg-…-soft` banners: `billing/pages/InvoiceDetailPage.tsx`,
    `clients/central/LinkCentralDialog.tsx`, `wip/components/AdjustmentsView.tsx`,
    `settings/components/roles/RoleEditor.tsx`.
- **Toast wording.** "Client created", "Job created" and `Role "…" created`, vs "… added"
  elsewhere.
- **Export trigger.** A popover menu in audit, reports, time analysis and wip, vs a direct
  button in `InvoicesPage.tsx` and `TimeEntriesPage.tsx`. `TeamTimesheetsPage.tsx` uses an
  `outline` Export button where the others use `brand-outline`.

### 3.8 Badges and status labels

- **Job status `cancelled`:** "Cancelled" in red in `jobs/constants.ts` (`JOB_STATUS_META`), but
  "Closed" in grey in `clients/workspace/constants.ts` (`JOB_STATUS_LABELS`). That map also has no
  `closed` status, which jobs shows in violet.
- **Expense billing status:** unbilled is grey in `expenses/constants.ts` but violet in
  `clients/workspace/constants.ts`. Written off is orange in one and grey in the other.
- **Invoice and payment maps** are duplicated in `billing/constants.ts` and
  `clients/workspace/constants.ts`. The clients copy is a subset.
- **Tickets** don't use `Badge`. They use their own tone palette (`tickets/constants.ts`) with
  Title Case labels ("In Progress", "On Hold"), where jobs uses "In progress", and "Closed" is
  green.
- **The Clients list** shows type, segment and central status as `cc-badge` / `cc-pill`
  (`clients/components/ClientCells.tsx`), while the workspace uses `Badge`
  (`clients/workspace/badges.tsx`, `central/CentralChip.tsx`).
- **Canonical:** one status map per entity, owned by its feature and exported through `index.ts`.

### 3.9 States, pagination, misc

- **Ad-hoc empty or loading text** instead of `EmptyState` or `Skeleton`:
  `billing/components/debtors/DebtorInvoicesDialog.tsx`, `time/components/team/PersonSheetDrawer.tsx`,
  `settings/components/periodLock/PeriodGrid.tsx`, `jobs/components/JobFormPanel.tsx`,
  `wip/components/TransferDialog.tsx`, `ClientsPage.tsx` (`cc-state`).
- **`LoadError` is redefined 10 times** (each feature's `PageShell.tsx`,
  `settings/components/LoadError.tsx`, `tickets/components/Notices.tsx`,
  `clients/workspace/records/RecordTable.tsx`). `dashboard/components/WidgetStates.tsx` doesn't
  use `ErrorState`.
- **Load failures as bare red text:** `team/components/staff/StaffPermissionsCard.tsx`,
  `StaffSegmentsCard.tsx`, `team/pages/StaffDetailPage.tsx`.
- **Pagination.**
  - Clients uses its own `cc-load-more` and infinite scroll (`ClientsTable.tsx`).
  - `wip/components/TransferDialog.tsx` hand-rolls "Load more".
  - Labels vary: "Show more", "Show N more", "Load older entries".
- **Utility copies.** `ExportMenu.tsx` is copied 4 times. `WorkingDaysField.tsx` exists in both
  settings and team. `utils/errors.ts` (`dialogError`, `describeFailure`) is copied across
  features, and named `describeError` in settings and clients.
- **Page title casing.** Sentence case: "Credit notes", "Recurring invoices", "Expense claim".
  Title Case: "Client Statements", "Create Invoice", "Expense Claims", "Pending Approvals". These
  are `PageShell`/`PageHeader` titles in the billing, expenses and dashboard pages. The
  navigation labels in `navigation.ts` are all Title Case. Also "Add Client" in
  `clients/components/ClientFormPanel.tsx`.
- **Raw hex in TSX:** `clients/pages/ClientsPage.tsx` (an SVG illustration) and
  `settings/components/templates/AccentColorField.tsx` / `InvoicePreview.tsx` (template colours,
  arguably data).
