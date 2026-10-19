# Settings: VAT codes, numbering and invoice templates (UI)

Settings → VAT Codes, Invoice Numbering, Credit Note Numbering, Estimate Numbering and Invoice
Templates (spec 2.22) are built from `capiumtimenfeeapi/docs/modules/invoice-templates.md`,
`docs/modules/clients.md` ("Settings": `/vat-rates`, `/sequences`) and `docs/domain.md`
("Practice settings", "Invoice templates"). Nothing here changes the API and no permission was
added. Money is pence, VAT rates are basis points on the wire and percentages on screen.

## Pages and permissions

| Route (`settings/…`)    | Page                  | Who opens it | Changes need                                                              |
| ----------------------- | --------------------- | ------------ | ------------------------------------------------------------------------- |
| `vat-codes`             | VAT Codes             | any member   | `settings.manage`                                                         |
| `invoice-numbering`     | Invoice Numbering     | any member   | `organization.update`                                                     |
| `credit-note-numbering` | Credit Note Numbering | any member   | `organization.update`                                                     |
| `estimate-numbering`    | Estimate Numbering    | any member   | `organization.update` (once the API lists the `estimate` sequence)        |
| `invoice-templates`     | Invoice Templates     | any member   | `settings.manage` (add, edit, activate, deactivate, delete, make default) |

The API answers every read to any member (`GET /vat-rates`, `GET /sequences`,
`GET /invoice-templates`), so the page rules in `constants/navigation.ts` are "every member". The
Invoice Templates rule used to be `settings.manage` or `organization.update`, which matched no
permission of that endpoint; it is now open like the others. Without the writing permission a page
shows its data with the controls missing or disabled and says why; the API still checks every
request (403 is shown as a toast or on the form).

## Folder

Everything is new files inside `src/features/settings/` (the pages replace their placeholders and
keep their names and default exports):

- `billingTypes.ts`, `api/billingApi.ts` (typed calls), `api/billingHooks.ts` (TanStack hooks and
  `billingKeys`); the keys sit under `queryKeys.org.vatRates`, `.sequences` and
  `.invoiceTemplates` (the last two are new in `constants/queryKeys.ts`). The VAT list shares the
  `vat-rates` root with the Team module's pickers, so a change here refreshes them.
- `schemas/billing.ts` (zod), `utils/{vat,numbering,templates,billingErrors}.ts` (labels, percentage
  and number maths, sample invoice lines, API error mapping), `hooks/useUrlSearch.ts`.
- `components/vat/VatRateFormDialog.tsx`, `components/numbering/NumberingForm.tsx` (the one component
  behind the three numbering pages), `components/templates/{InvoiceTemplateFormDialog,InvoicePreview}.tsx`,
  `components/{LoadError,DialogActions}.tsx`.
- `test/billingFixtures.ts` and `test/billingHandlers.ts`: an in-memory fake of the three endpoints
  that follows the API's rules (409 codes, default handling, archive-on-delete) and records every
  request.
- `index.ts` also exports `useInvoiceTemplates` and the `InvoiceTemplate` type for the client billing
  settings.

Shared files touched, each by a few lines: `constants/queryKeys.ts` (the two keys),
`constants/navigation.ts` (the Invoice Templates rule), `features/settings/index.ts` (the export) and
`app/router/orgRouting.test.tsx` (see "Tests").

## VAT codes

One bounded list (`GET /vat-rates?include_archived=true`, archived last); tabs (All / Active /
Archived), quick search, sortable columns and the column menu work on the client. Columns: name,
code (Standard, Reduced, Zero rated, Exempt, Outside scope), rate, default badge, status.

- **Add / edit** (dialog): name (1–60), code, rate as a percentage with up to two decimals (0–100).
  Zero rated, exempt and outside scope charge no VAT, so choosing one sets the rate to 0% and locks
  it (the API itself would accept another rate). Editing sends only the changed fields; saving
  nothing changed is not offered. "Make this the default" is only offered when adding.
- **Row actions**: Edit, Make default, Archive (confirmation; says when it is the default), Delete
  (confirmation). An archived code offers Restore and Delete only. Archiving and deleting never fail
  for "in use": `DELETE` answers `data.outcome` `deleted` or `archived`, and the toast says which.
- 409 `VAT_RATE_NAME_TAKEN` is shown on the name field. A practice that is not VAT registered gets a
  note that every line carries 0% VAT, with a link to Practice Settings.

## Numbering

`NumberingForm` reads `GET /sequences` (always refetched on opening: the next number moves as
documents are issued) and finds its kind. Prefix (≤ 12 of letters, digits, `-`, `_`, `/`; may be
empty), zero padding (1–10) and next number (1–2,000,000,000) are validated like the API; a live
preview shows the next number and the two after it (`INV-00042`, as `format_number` prints it).

- Saving sends only the changed fields (`PATCH /sequences/{kind}`) and needs `organization.update`.
- The kinds only move forward. The form refuses a lower next number with the current number named;
  the API's 409 `SEQUENCE_BACKWARDS` (the number moved meanwhile) and 409 `SEQUENCE_NUMBER_TAKEN`
  (the number already exists) are mapped to the next-number field, and the sequence is refetched
  while the typed value stays.
- **Estimates**: the API has no `estimate` sequence yet. Until `GET /sequences` returns it the page
  shows "Estimate numbering is not available yet" and never calls `/sequences/estimate`; the form
  appears by itself once the kind is listed. Estimates are treated as forward-only like invoices
  (`FORWARD_ONLY` in `utils/numbering.ts`: one line to change if the API decides otherwise).

## Invoice templates

`GET /invoice-templates`, with `include_inactive=true` only for `settings.manage` (the API answers
403 to anyone else, so others do not ask and see the active templates). Columns: name with the
default badge, layout, logo, bank details, footer, clients using it, status.

- **Dialog** (add, edit, and a read-only "Preview" for people who cannot change templates): name
  (≤ 80), layout (Standard, Detailed: every time entry, Summary: one line per job), show logo, show
  bank details, footer text (≤ 1000) with a counter. Next to the fields (below on a phone) a preview
  draws a mock invoice from the fields as they change: the practice's letterhead and bank details from
  its settings, made-up lines per layout, 20% VAT (0% when the practice is not VAT registered), the
  footer. It is static HTML and CSS with tokens; it says it uses sample data and that the PDF renderer
  will apply the template (the PDF is not wired to templates yet, see the API document).
- **Row actions**: Edit, Make default (active, not default), Deactivate / Activate, Delete. The default
  template cannot be deactivated or deleted (the items are disabled and the page says why).
- **TEMPLATE_IN_USE**: Delete on a template that clients use opens "Deactivate template?" and
  deactivates instead. If the count was stale and the API refuses (409 with `details.clients`) the
  dialog shows the refusal with the number of clients and, as the list refreshes, offers Deactivate.
- 409 `TEMPLATE_NAME_TAKEN` is shown on the name field.

## Tests

Per page (`pages/*.test.tsx`): loading, list, empty, error with retry, permission cases, the exact
request bodies, validation messages, 409 mapping, confirmations. Numbering: preview, forward-only
(client side and API refusals), estimate kind missing and present. Templates: the preview follows the
layout, logo, bank details and footer. `utils/*.test.ts` cover the percentage and number maths and
the error mapping. `app/router/orgRouting.test.tsx` mocks the VAT Codes and Invoice Numbering pages
(they are no longer placeholders).
