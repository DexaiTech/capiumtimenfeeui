# LEADS-02 – Lead form in sections like the client form (R-06) + lead count on the Clients switch (R-02 remainder)

Status: **Approved 10 Nov 2026 and being implemented.** Decided: Notes folded on Add and open on
Edit; Source under "About the lead"; the new section wording as written in §7. Built on the PR #27
branch; its own PR is opened only after PR #27 merges.
Tracker: R-06, R-02 (`TIMEFEE-RAJ-MEETING-MASTER-TRACKER.md`, "Status audit — 10 Nov 2026" A and E.3).
Scope: TimeFee UI only. **No API or database change.** Base: `main` `61ebf18`, **rebased onto `main`
after PR #27 merges** (see §16). Line numbers are `61ebf18` unless marked "#27".

## 1. Original requirement

- R-06, Raj, 9 Nov 2026: Add/Edit lead should have "exactly the same fields… should follow the same
  pattern" as the client form. Owner decision (9 Nov, tracker l.23): **lead form in sections with
  the same fields** – no client fields added.
- R-02 remainder (tracker A, R-02 "Remaining work"; PR #27 review B "Low"): "the lead count on the
  Clients/Leads switch is missing". The title part of R-02 is done in PR #27.

## 2. Interpretation

1. `LeadFormPanel` keeps its 9 fields, labels, hints, validation, payloads, title/description and
   "Add lead"/"Save lead" buttons, but is laid out the way `ClientFormPanel` is: required-fields note
   at the top, titled `FormSection` groups, `DialogActions` footer (Cancel first).
2. On the Client List, the switch's Leads tab shows the open-lead count, exactly as it already does
   on the Leads page; and both pages put the title above the switch.

## 3. Existing implementation

**Client form** `src/features/clients/components/ClientFormPanel.tsx`: `<form className="flex flex-col gap-5">`
(l.158-162), `FormAlert` (l.164-166), note "Fields marked with a red star are required." (l.167), **5**
sections (the tracker's "11" counts grep hits incl. closing tags and the import): About the client
`grid sm:grid-cols-2`, name `sm:col-span-2` (l.168-222); Company and tax numbers, collapsible
(l.224-248); Contact and address (l.250-304); How you work…, collapsible (l.306-372); Notes,
collapsible, `defaultOpen={client !== null}`, `forceOpen` on its errors (l.374-389). Footer
`DialogActions` Cancel + primary (l.391-396).
**Lead form** `src/features/clients/leads/LeadFormPanel.tsx`: flat `<form className="flex flex-col gap-4">`
(l.100-105), `FormAlert` (l.106-108), no required note; Name* (l.109-117), Client type (l.118-123), a
2-col grid of Contact name, Source, Email, Phone, Acquisition, Onboarding (l.124-171), Total cost line
(l.172-177), Notes (l.178-185); footer `DialogActions` (l.187-198), "Save lead" disabled until dirty
(l.194). `FormPanel` title "Add lead"/"Edit lead" + description (l.206-213). PR #27 adds
`RecordHistory` between `</form>` and the footer (#27 l.191-195) and currency-aware costs (#27
l.32-34, 43, 63-68; `schema.ts` `leadFormSchema(currency)`).
**Shared** `src/components/ui/FormSection.tsx`: non-collapsible = `<section aria-labelledby>` + `h3`
(l.39-51); collapsible = `<details>` (l.53-71). Used by 3 forms (`ui-standards.md` l.24 says 3:
ClientFormPanel, JobFormPanel, StaffFormFields). `FormPanel` focuses the first enabled field
(`FormPanel.tsx:19-20, 43`).
**Switch** `components/ClientsLeadsSwitch.tsx`: `leadCount` prop, `undefined` = no badge, `null` =
"–" (l.17-19, 46). Client List: `ClientsToolbar.tsx:73-74` renders it with **no `leadCount`**;
`leadsHref` is only used as a flag (l.27-28, 73). `ClientsPage.tsx:490-491` passes `clientCount` +
`leadsHref`. Leads page: `LeadsPage.tsx:547-557` passes `clientCount={clients.data?.total ?? null}`
and `leadCount={leads.data?.open.count ?? null}` from `useLeadSummary()` (`api/leads.ts:76-82`,
key `leadKeys.summary`, l.59; API `GET /leads/summary`, `client.read`, API `docs/modules/clients.md`
l.492). **Order:** Leads = switch row (l.552-558) **above** `PageHeader` (l.559-563); Clients after
PR #27 = `PageHeader` (#27 l.484-488) **above** the toolbar holding the switch (#27 l.495).

## 4. Root cause

- R-06: the lead form was built flat (APT49) before `FormSection` became the client-form pattern; a
  layout gap, not a defect.
- R-02: `ClientsToolbar` never receives a lead count – `ClientsPage` doesn't read the lead summary –
  and LeadsPage renders the switch before its title while Clients renders it after.

## 5. Affected screens

Clients › Leads: Add lead and Edit lead panels (all tabs; Edit exists on open/converted/archived),
and the page header area. Clients › Client List: switch's Leads tab. No other screen uses
`LeadFormPanel`, `ClientsToolbar` or `ClientsLeadsSwitch` (grep: only `ClientsPage.tsx:37,489`,
`LeadsPage.tsx:46,553`). Router tests mock `ClientsPage` (`src/app/router/*.test.tsx`).

## 6. Files

- `src/features/clients/leads/LeadFormPanel.tsx` – JSX regrouped into sections (logic untouched).
- `src/features/clients/components/ClientsToolbar.tsx` – new optional `leadCount` prop passed to the switch.
- `src/features/clients/pages/ClientsPage.tsx` – `useLeadSummary()`; pass `leadCount`.
- `src/features/clients/pages/LeadsPage.tsx` – `PageHeader` before the switch (move only).
- `src/features/clients/test/handlers.ts` – `/leads/summary` handler in `clientsHandlers()`;
  `src/features/clients/test/leads.ts` – export `summaryOf` (as `leadSummaryOf`) for it.
- Tests: `pages/LeadsPage.test.tsx`, `pages/ClientsPage.test.tsx`, `components/ClientsLeadsSwitch.test.tsx`.
- `docs/ui-standards.md` l.24 – `FormSection` use count 3 → 4.
- **Not changed:** `leads/schema.ts`, `leads/types.ts`, `api/leads.ts`, `ClientsLeadsSwitch.tsx`,
  `FormSection.tsx`, `FormPanel.tsx`, `ClientFormPanel.tsx`.

## 7. Proposed solution

**A. Lead form (R-06)** – same shell as the client form:

1. `<form className="flex flex-col gap-5">`; `FormAlert`; then the note "Fields marked with a red
   star are required." (`text-xs text-text-muted`, as client l.167).
2. **About the lead** (`grid gap-4 sm:grid-cols-2`): Name* (`sm:col-span-2`), Client type, Source.
3. **Contact** (`grid gap-4 sm:grid-cols-2`): Contact name (`sm:col-span-2`), Email, Phone.
4. **Costs** (`grid gap-4 sm:grid-cols-2`, description "Optional. A blank amount counts as nothing
   spent."): Acquisition cost, Onboarding cost, the Total cost line (`sm:col-span-2`).
5. **Notes**: collapsible like the client's Notes, description "Optional.", `defaultOpen={lead !== null}`,
   `forceOpen={Boolean(errors.notes)}`; the Notes textarea and its hint unchanged.
6. Keep after `</form>`: PR #27's `RecordHistory` (Edit only, `client.read`), then `DialogActions`
   (Cancel, "Add lead"/"Save lead", dirty rule) – unchanged.
   Every label, hint, `maxLength`, `inputMode`, `register` call, the `useWatch` total and the PR #27
   currency code stay byte-identical; only their parents change. Grouping differs slightly from the
   consistency plan §6.4 (it put Source under Contact): Source says where the lead came from, so it
   sits with name and type, and Contact matches the client's "Contact" group. Either is a one-line move.
   **B. Lead count (R-02)**
7. `ClientsToolbar`: add `leadCount?: number | null` and render
   `<ClientsLeadsSwitch current="clients" clientCount={…} leadCount={props.leadCount} />` (l.74).
   `leadsHref` and the no-switch fallback (l.75-83) stay as they are (backward compatible).
8. `ClientsPage`: `const leadSummary = useLeadSummary();` beside `useClientSummary()` (l.138) and
   `leadCount={leadSummary.data?.open.count ?? null}` – the same source and rule as `LeadsPage.tsx:556`.
   Same query key, so switching pages reuses the cache; no new endpoint.
9. `LeadsPage`: render `PageHeader` first, then the `capium-clients` switch wrapper – title, then
   switch, on both pages. (Putting the switch inside the Leads `PageToolbar` is a bigger layout
   change; left to R-14/R-15.)

## 8. UI changes

Lead panels gain the required note, four headed groups and a folded Notes group on Add; tab order
becomes Name, Client type, Source, Contact name, Email, Phone, costs, Notes. Client List: "Leads 2".
Leads page: switch moves below the title. No copy, permission or rule change beyond the note and the
two section descriptions (copy for approval).

## 9. API changes

None (`GET /leads/summary` exists, `client.read`, same as the Client List). **10. DB changes:** none.

## 11. Edge cases

- Summary loading or failed: Leads tab shows "–", as on the Leads page today.
- Count is **open** leads (the Leads default tab), the same number on both pages; converting or
  archiving invalidates `leadKeys.all` (`api/leads.ts:85-91`) so the Client List refetches on mount.
- Notes folded on Add: a server error on `notes` (`useSubmitError`, `LEAD_FORM_FIELDS`) opens it via
  `forceOpen`; Ctrl/Cmd+Enter still submits; the first-field focus stays on Name.
- Edit of converted/archived leads: same form (API keeps costs editable after conversion).
- Practice currency ≠ GBP (PR #27): labels keep the symbol; parsing unchanged.
- Narrow widths: grids collapse to one column below `sm`, as the client form.

## 12. Regression risks

- `LeadsPage.test.tsx` LeadFormPanel tests (l.457-532 + PR #27's R-17/R-18) query by label/role, not
  order – unaffected; `region` "Add lead"/"Edit lead" stays unique (sections are named differently).
  Fields inside a closed `<details>` stay queryable in jsdom (precedent `ClientsPage.test.tsx:382`
  types into the folded "Company number").
- No non-collapsible section is titled like a field, so `getByLabelText` cannot match two nodes.
- `ClientsLeadsSwitch.test.tsx:76` expects link name exactly "Leads" with no count – unchanged
  (component test passes no `leadCount`). New page tests use `/^Leads/`.
- MSW fails unhandled requests (`src/test/setup.ts:40`): every test rendering `ClientsPage` must
  answer `/leads/summary`. All do via `clientsHandlers()` (ClientsPage, ClientsBulk, branches,
  central tests); router tests mock the page.
- `LeadsPage.test.tsx` "heading level 1 Leads" + nav (l.80-90) – unaffected by the move.
- CRLF files: keep line endings; Prettier check via `tr -d '\r'` (UI `CLAUDE.md`).

## 13. Testing strategy

- `LeadsPage.test.tsx` (new): Add lead shows the note; regions About the lead / Contact / Costs hold
  their fields (and Total cost); Notes folded on Add, open on Edit; a 422 on `notes` opens it;
  existing add/validate/edit/history/currency tests unchanged and passing. Title precedes the switch
  (`compareDocumentPosition`).
- `ClientsPage.test.tsx` (new): Leads tab link shows the open count ("2" from `testLeads`); title
  precedes the switch.
- `ClientsLeadsSwitch.test.tsx` (new case): Client List with `leadCount` shows it on the link.
- Then the `src/features/clients` folder, the **full** UI suite (`--maxWorkers=2
--testTimeout=120000`; `InvoiceDraftLines` 30 s timeout is pre-existing), typecheck, lint,
  Prettier, build; failures classified pre-existing/new; React key/act warnings checked.
- Local browser (API + `npm run dev`): Add/Edit lead (open, converted, archived) at 1440/768/375 px;
  save, validation, history, Cancel and Escape guard; Client List and Leads switch counts and order;
  roles Owner and Staff (`client.read` only: no Add lead, counts visible).

## 14. Acceptance criteria

- Add/Edit lead: required note, sections About the lead, Contact, Costs, Notes (folded on Add), same
  9 fields, same rules, payloads, buttons and PR #27 history/currency behaviour.
- Client List's Leads tab shows the open-lead count ("–" while loading), equal to the Leads page's.
- Title above the switch on both pages. No API/DB change; tests above pass; full suite reported.

## 15. Not in this ticket

R-04b bulk archive/unarchive; lead filters (OPEN-1); row click opens the lead (OPEN-2); "stage"
(OPEN-3); one CSV rule (OPEN-4); client fields on the lead form (owner: no; Raj to confirm); Clients
toolbar wrapping (R-14); moving the Leads switch into its toolbar (R-15). Observed, not fixed:
LeadsPage tests have no `/clients/summary` handler although the page calls `useClientSummary`
(`LeadsPage.tsx:547`; grep finds the handler only in `test/handlers.ts`) – check the run's stderr;
the hard-coded Leads description differs from `pageDescriptions.ts:18-19`.

## 16. Branch, PR and dependency on PR #27

Branch `feature/timefee-leads-02`; one UI PR; no API PR; no merge without approval. **PR #27 merges
first**, then rebase. Exact overlap with PR #27: `LeadFormPanel.tsx` (#27 imports l.2,8-9, schema
`useMemo`, `penceOf`/`toLeadPayload(currency)`, `RecordHistory` l.192-195 – LEADS-02 rewraps only
the JSX between `<form>` and `</form>`, #27 l.105-191, and adds `FormSection` to the l.6 import);
`ClientsPage.tsx` (#27 l.7-9, 484-488 – LEADS-02 edits the `../api` import, l.~140 and the toolbar
props l.~497); `LeadsPage.tsx` (#27 l.528-542 – LEADS-02 moves #27 l.559-571); `LeadsPage.test.tsx`,
`ClientsPage.test.tsx`, `test/leads.ts` (#27 adds tests and the history handler – LEADS-02 adds
tests and one export). `leads/schema.ts` is changed by #27 only. PR #28 touches `LeadsPage.tsx` at
one line (l.418, `compactLabel`) – no overlap. Graphify (`capium-graph/graphify-out`, 5 Nov) predates
`ClientsLeadsSwitch` (7 Nov), so it was not relied on; all references were read in code.
