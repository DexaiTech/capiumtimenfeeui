# Notifications and email templates (UI)

The bell in the top bar, Settings → Notifications and Settings → Email Templates are built from
`capiumtimenfeeapi/docs/modules/notifications.md` (spec 2.21). Nothing here changes the API and no
permission was added.

## Pages and permissions

| Where                                        | Needs                                                                    | Notes                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| The bell (top bar, every page of a practice) | any member                                                               | own notifications only                                                               |
| `settings/notifications`                     | any member                                                               | the second card (practice defaults) needs `organization.update` or `settings.manage` |
| `settings/email-templates`                   | `organization.update` or `settings.manage` (the API refuses anyone else) | reading the templates needs the same permission as writing them                      |

The page rules are the ones in `constants/navigation.ts` (Notifications has no rule, Email Templates
has `anyOf [settings.manage, organization.update]`). A page opened without its permission shows
"You don't have access" and asks nothing of the API; the practice card of the notification
settings is not rendered, and not requested, for anyone without the permission.

## The bell

`components/layout` knows no feature: it draws what `ShellData.notifications` (`ShellNotifications`)
describes. `features/notifications` builds that object (`useNotificationsShell`) and the shell route
(`AppShellRoute` in `app/router/layoutRoutes.tsx`) passes it to `buildShellData`. Without it (tests of
the chrome, outside a practice) the bell is the old "You're all caught up" panel.

- **Count** — `GET /notifications/unread-count` every 60 s (not while the tab is hidden) and whenever
  the window is focused (`refetchOnWindowFocus: 'always'`, because the app-wide default is off). A failed
  poll keeps the last count. The badge shows the count, capped at `99+`; the accessible name of the button
  is "Notifications, N unread" (plain "Notifications" with none).
- **List** — read only while the panel is open (`GET /notifications`, 20 per page, newest first, "Load
  more" follows `meta.next_cursor`). A changed unread count marks the list stale, so it follows while
  open. Loading, empty ("You're all caught up") and error (with "Try again") states are shown.
- **Choosing one** — marks it read (`POST /notifications/{id}/read`, only when unread), closes the panel
  and opens its page. The API's `link` is relative to `/{slug}`; anything that is not a path starting with
  one `/` (an absolute URL, `//host`, `/\host`) leads nowhere, so a notification cannot send the person
  to another site. "Mark all as read" calls `POST /notifications/read-all`. Both refresh the count and
  the list.
- **Icons** — one per catalogue type (clock, undo, clipboard, gauge, send, banknote, warning); an
  unknown type gets the bell. Unread rows are bold with a dot and the text "Unread:" for assistive
  technology (text, not colour alone).

## Notification settings

One card for the person (`GET/PUT /notification-settings`): seven types in rows, In-app / Email / SMS in
columns, a mobile-number field. A type the practice switched off is locked with an explanation; a type
the person has not chosen says "Using the practice default". **Only the types the person changed are
sent** (and the number only when edited), so the untouched types keep following the practice's defaults.
Save and Discard work on the card; "You have unsaved changes" is announced. A 422 on `sms_number` (SMS
without a number, a malformed number) is shown on the field; anything else is a toast.

The second card (`GET/PUT /notification-settings/practice`, only with `organization.update` or
`settings.manage`) has the same matrix plus an "On" column: a type switched off is off for everyone
and its channel boxes are locked. Again only the changed types are sent, each with all four fields.
Saving it refreshes the person's own matrix, because switches and defaults change what it shows.

## Email templates

A list (`DataTable`: name and description, kind System / Notification, Customised / Default, last
edited as `dd/MM/yyyy HH:mm` in the practice's time zone and by whom). The editor (`?template=<key>`,
so it can be linked and the back button works) has:

- Subject, HTML body and plain-text body (all three are always sent on save).
- **Merge-field chips**, one per field the API lists for the template (and no other): choosing one
  inserts `{{ name }}` at the caret of the field used last (replacing a selection) and puts the caret after
  it. A required field (`link` of the two invitations) is named in the hint.
- A **live preview** (`POST …/preview`, debounced 500 ms, one request per pause): the subject, and the
  whole email in a `sandbox=""` iframe (nothing runs) or as plain text. A draft the API refuses (422)
  has its problems shown on the fields as the person types, with the same codes a save would give; the
  preview waits for them to be fixed. Problems that belong to no field are listed above the fields.
- **Save template** (`PUT`), **Discard changes**, and **Reset to default** (only for a customised
  template, behind a `ConfirmDialog`; `DELETE`). A refused save keeps the text; editing again clears the
  messages of the save.

## Folder

`src/features/notifications/`: `api/` (typed calls, TanStack hooks, `notificationKeys`), `hooks/`
(`useNotificationsShell`), `components/` (`settings/`, `templates/`, `SaveBar`), `utils/` (errors,
draft helpers), `types.ts`, `constants.ts`, `test/` (fixtures and an in-memory fake of the endpoints
with a record of every request). `index.ts` is the surface: `useNotificationsShell`,
`NotificationSettingsView` and `EmailTemplatesView`; the two settings pages are thin files that render
the views (the router keeps loading them from `features/settings/pages/`).
Query keys: `queryKeys.org.notifications`, `notificationSettings` and `emailTemplates`.

## Tests

- `components/layout/HeaderPanels.test.tsx`: badge, `99+`, accessible name, list, unread marker, choosing,
  mark all, load more, loading, error, empty, settings link.
- `features/notifications/hooks/useNotificationsShell.test.tsx`: polling with fake timers, window focus,
  the list read only when open and paged by cursor, mark read / mark all, a failed list and a failed poll,
  the link rules.
- `app/router/notificationsBell.test.tsx`: the bell in the real shell (count, open, navigate, mark all).
- `features/settings/pages/NotificationSettingsPage.test.tsx` and `EmailTemplatesPage.test.tsx`: loading,
  list, error, permission cases, the exact request bodies, validation on the fields, the confirmations.

The shell asks for the unread count in every practice, so `src/test/server.ts` answers it with 0 by
default; a test that cares installs `notificationHandlers(...)` from `features/notifications/test`.
