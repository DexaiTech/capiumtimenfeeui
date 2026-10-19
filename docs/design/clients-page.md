# Clients page — design specification

Source: Figma file `vfegvTrf6ubsi5K5dqpikg` ("Capium"), page `1053:239`, frame
`1448:52512` "Clients list View" (1440 × 862). Renders: [clients-list.png](clients-list.png),
[clients-list@2x.png](clients-list@2x.png). Values below were read from the Figma API, not
estimated.

## Tokens

| Token                         | Value                         | Used for                                                                                    |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `--color-primary`             | `#694BAF`                     | Top bar background, primary button, active count tab, chip text, links, selected-row marker |
| `--color-primary-10`          | `#694BAF` at 10%              | Chip backgrounds (services, segment Platinum, count badge), outline-button hover            |
| `--color-primary-5`           | `#694BAF` at 5%               | Selected / hovered row background                                                           |
| `--color-primary-soft`        | `#B4A5D7`                     | "PRACTICE MANAGEMENT" subtitle, light avatar background                                     |
| `--color-on-primary-10/12/20` | white at 10%, 12%, 20%        | Active nav pill, top-bar icon buttons, dividers in the bar                                  |
| `--color-text-strong`         | `#313B5E`                     | Client name                                                                                 |
| `--color-text`                | `#5D7186`                     | Body text, table headers, toolbar buttons, icons                                            |
| `--color-text-muted`          | `#8E9CAA`                     | Placeholder ("Quick search")                                                                |
| `--color-icon-dark`           | `#141B34`                     | Dark outline icons                                                                          |
| `--color-border`              | `#EAEDF1`                     | Row separators, card and input borders                                                      |
| `--color-track`               | `#E9E9E9`                     | Health bar track                                                                            |
| `--color-page`                | `#FBFAFD`                     | Content background                                                                          |
| `--color-success`             | `#069668` (+ 10% bg)          | Health text and bar, AML "Clear"                                                            |
| `--color-warning`             | `#D97707` (+ 10% bg)          | "Limited" type badge, "Due today / Due in Nd"                                               |
| `--color-info`                | `#2663EB` (+ 10% bg)          | "Sole Trader" type badge                                                                    |
| `--color-danger`              | `#EF4444` (+ 10% bg)          | "Overdue by Nd"                                                                             |
| `--color-bronze`              | `#975100` (+ 10% bg)          | Segment "Bronze"                                                                            |
| `--color-xero`                | `#13B5D8`                     | "xero" software badge (white text)                                                          |
| Radius pill                   | `999px`                       | Badges, chips, avatars, icon buttons                                                        |
| Radius control                | `5px`                         | Toolbar buttons, search input, tab switch                                                   |
| Radius card                   | `10px`                        | Table card                                                                                  |
| Shadow card                   | `0 0 10px rgb(0 0 0 / 5%)`    | Table card                                                                                  |
| Shadow floating               | `0 2px 10px rgb(0 0 0 / 20%)` | Floating action buttons, menus                                                              |

Font: **Inter** throughout.

| Style                         | Size / weight / line height                       | Colour                       | Examples                                  |
| ----------------------------- | ------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| Brand name                    | 13 / 600 / 16                                     | white                        | "Kp Accounting" (the practice name)       |
| Brand subtitle                | 12 / 500 / 15, uppercase                          | `#B4A5D7`                    | "PRACTICE MANAGEMENT"                     |
| Nav, toolbar, header, cells   | 12 / 500 / 15                                     | `#5D7186` (white in the bar) | "Clients", "Filter", "Reg No", "678654QJ" |
| Client name                   | 12 / 600 / 15, uppercase, truncated with ellipsis | `#313B5E`                    | "TECHWAVE INN..."                         |
| Secondary line, badges, chips | 10 / 500 / 12                                     | per badge                    | "APX006", "Limited", "Clear", "Accounts"  |
| Avatar initials               | 10 / 600 (32 px avatar), 8 / 600 (22 px avatar)   | white                        | "TM", "RM"                                |
| Primary / outline buttons     | 12 / 600                                          | white / `#694BAF`            | "Add Client", "Import"                    |

## Layout

> **Scope decision (product owner, 17 Oct 2026):** the UI has **only the Clients menu** and
> **no sub-menu**. The top bar shows a single nav item, "Clients", and the white sub-header
> row from the design (Schedule, Communication, Submissions, Letters, AML) is not built.
> Practice settings (Practice, Staff, Roles, Rates, Services, Activity codes, VAT rates,
> Numbering, Audit log) are listed in the practice menu (the logo circle on the right of the
> bar); account, theme and sign out are in the user avatar menu. Neither is a nav item.

1. **Top bar**: full width, 60 px high, background `#694BAF`. Left: round logo mark, then the
   practice name over "PRACTICE MANAGEMENT". Centre-left: the single nav item "Clients" with a
   14 px icon and a 12/500 white label, shown active as a pill with a white 10–20%
   background, 5 px radius and 7 px padding. Right: a white circular search button (focuses
   the quick search), a white circular "+" button (Add Client), the practice logo circle, a
   divider, a bell (no-op until notifications exist) and the user avatar menu. Each icon
   button is a 30 px circle with a white 12% background and white outline icons. Leave out
   the folder and help icon buttons, which have no feature behind them.
2. **No sub-header.** The toolbar card sits directly under the top bar, with the 25 px page
   gutter as in the design. On a client detail page, show "‹ Back to Clients" as the first
   line of the page content instead.
3. **Toolbar card**: 1390 px wide, white, 8 px vertical padding.
   - **Left**: the tab switch, a 212 × 33 bordered box with 2/5 px padding holding two tabs.
     The active tab is a solid `#694BAF` pill with a white label and a count badge
     (white 20% background, white 10/500 text). The inactive tab has a `#694BAF` label and
     icon with a count badge (`#694BAF` 10% background). Labels are "Clients 12" and
     "Users 18". Next to it, the **quick search**: 241 × 29, 1 px `#694BAF` border, 5 px
     radius, a search icon, placeholder 12/400 `#8E9CAA`.
   - **Right**, gap 10, every control 29 px high with 7 px padding and a 1 px `#EAEDF1`
     border: "Show/Hide Columns ⌄" (column visibility menu), "Filter set" (saved filters),
     "Filter" (filter panel), "Analytics" (summary drawer), an icon-only button (bulk
     actions), "Drafts" (draft clients), a list/grid view toggle (the active one is solid
     violet), then "Import" and "Export" outlined in `#694BAF` with violet 600 text, and
     "Add Client" solid `#694BAF` with white 600 text and a user-plus icon.
4. **Table card**: white, 10 px radius. The header row is 37 px; body rows are 57 px with a
   1 px `#EAEDF1` separator. The selected/active row has a 5 px `#694BAF` bar on its left
   edge and a `#694BAF` 5% background. Columns, left to right, at x offsets measured from
   the card edge:

| Column        | x    | Content                                                                                                                                                                                                                                                                              | Sortable           |
| ------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| ☐             | 14   | 14 px checkbox (select row; header checkbox selects the page)                                                                                                                                                                                                                        | —                  |
| Client        | 45   | 32 px initials avatar (colour from name hash: orange `#D97707`, violet `#694BAF`, …) + name (12/600 uppercase, truncate ~140 px) over code (10/500 `#5D7186`) + type badge ("Limited" amber, "Sole Trader" blue, "Partnership", "LLP", "Individual", …) + software badge (Xero cyan) | yes (⇅ icon 3 × 7) |
| Reg No        | 242  | Company number                                                                                                                                                                                                                                                                       | —                  |
| Segment       | 343  | Pill: Bronze (bronze), Silver, Gold, Platinum (violet)                                                                                                                                                                                                                               | yes                |
| Health        | 448  | "83/100" 10/500 green over a 59 × 5 bar (track `#E9E9E9`, fill green; amber under 60, red under 40)                                                                                                                                                                                  | yes                |
| Contact       | 555  | 22 px avatar + primary contact name, or an outlined violet "+ Add" pill (50 × 22) that opens the add-contact dialog                                                                                                                                                                  | —                  |
| Contact Email | 647  | Primary contact email (falls back to client email)                                                                                                                                                                                                                                   | yes                |
| Deadlines     | 806  | Pill: red "N Overdue by Nd", amber "N Due today" / "N Due in Nd", none when clear                                                                                                                                                                                                    | —                  |
| AML           | 939  | Pill: Clear (green), Pending (amber), Review (blue), Failed (red), Not started (grey)                                                                                                                                                                                                | yes                |
| Activity      | 1016 | Last activity "20/05/2026 - 09:23PM" (dd/MM/yyyy - hh:mma, practice time zone)                                                                                                                                                                                                       | —                  |
| Services      | 1179 | First service chip (violet 10% background, violet text) + a "+N" round outline chip; hover shows all                                                                                                                                                                                 | —                  |
| Action        | 1319 | 24 px "more" circle icon → menu: View, Edit, Log time, New job, Create invoice, Archive                                                                                                                                                                                              | —                  |

5. **Floating buttons** (bottom right): three 62 px violet circles with the floating shadow
   and white icons (chat, history, messages). They are part of the global Capium chrome:
   render them only if a feature exists behind them. Omit them for now.

## Behaviour

- Data: `GET /api/v1/organizations/{id}/clients` with `q`, filters, `sort`, `order`,
  `cursor`, `limit`. Counts for the tabs come from `GET …/clients/summary` (clients total) and
  the active staff count (Users).
- Quick search debounces 300 ms and filters by name, code, company number and contact email.
- Column visibility and the list/grid choice are remembered per user (localStorage, guarded).
- The "Users" tab shows the staff list in the same table style (name, role, email, status).
- Infinite scroll or "Load more" with the cursor; keep the header sticky.
- Empty state: illustration, "No clients yet", primary "Add Client" and secondary "Import".
- Accessibility: the table is a real `<table>`, sort buttons have `aria-sort`, badges carry
  text (not colour only), and checkboxes have labels ("Select TECHWAVE INNOVATIONS").
