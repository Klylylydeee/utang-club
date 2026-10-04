# Handoff — Utang Club

*Last updated: 2026-10-04. Pushed to <https://github.com/Klylylydeee/utang-club> (`main`).*

This is a snapshot of where the build stands, for whoever picks it up
next. `PHASING.md` holds the plan, the decisions (D1–D18) and the
decision log. `SETUP.md` explains how to install and run the server.
This file covers what exists, how it was verified, what's still loose,
and what to build next, including the recommended design for exporting
a summary as an image or PDF.

## Status at a glance

| Phase | Scope | State |
|-------|-------|-------|
| 0–4 | Repo, foundation, settlement engine, security, tabs and people | ✅ Done |
| 5 | Transaction entry (desktop spreadsheet, phone list and sheet) | ✅ Done |
| 6 | Settlement cards, by-person totals, copy summary | ✅ Done |
| 7 | Record payment, split a bill | ✅ Done |
| 9 | Accounts, roles, admin area, enterprise look, activity copy (D15–D18) | ✅ Done |
| — | **Export summary as image / PDF** | 💡 Recommended next feature (see below) |
| 8 | Hardening: Playwright suite in the repo, a11y pass, loading/error states | ⏭️ Not started |

`pnpm check` passes: typecheck, lint and **242 tests in 22 files**
(unit tests plus in-memory MongoDB tests). `pnpm build` succeeds.

## What the product is now

A multi-user web app for splitting shared expenses by activity (a trip,
a night out, a dinner). Each activity is a **tab**: you add the people
(plain names, no accounts needed), record who owes whom, and the app
nets each pair into "who pays whom", traceable to the rows behind it.

- **Users** register with email and password and see only their own
  tabs.
- **Administrators** also see every user's tabs (read-only) and manage
  accounts: disable or enable, change role, set a new password. There
  is no email of any kind.
- **Look:** enterprise style everywhere (D18). Navy app bar, slate
  neutrals, split-screen sign-in, admin tables. Indigo marks actions;
  green means money coming back or settled; red means errors.

## Changes the owner asked for along the way

- "Trip" became "Tab"; later, tabs became **per activity** instead of
  per month. New tabs start blank.
- A single-password login (D11–D13), later replaced by **accounts and
  roles** (D15–D17).
- **Everything must work by touch** from a phone on the LAN, in dev and
  production builds (D14).
- **Split rounding:** leftover centavos go to the debtors in name order;
  the payer is ticked by default (`SETTLEMENT_RULES.md` → *Splitting a
  bill*).
- Record payment, split a bill, copy summary, phone entry, by-person
  totals.
- An enterprise look **everywhere**, overriding the original "not like
  an enterprise product" line in `AGENTS.md`.
- The account menu has only **Sign out**; "Sign out on all devices" was
  removed. Admin disable and password reset still sign a user out
  everywhere.

## Where things live

| Area | Code |
|------|------|
| Settlement maths (pure) | `src/lib/settlement/`: engine, money, `splitAmount`, `personTotals`, ordering |
| Settlement view model | `src/lib/settlements/`: `buildSettlementSummary`, `summaryText`, `settlementService` |
| Tabs, people, access checks | `src/lib/tabs/tabService.ts` (`loadReadableTab` / `loadOwnedTab` / `loadWritableTab`) |
| Transactions, splits, payments | `src/lib/transactions/`, `src/lib/payments/` |
| Accounts | `src/lib/users/userService.ts`, `src/lib/auth/` (sessions, throttle, `authedAction`, `Actor`) |
| Server Actions | `src/actions/` (every one wrapped in `authedAction`; a test enforces it) |
| Pages | `src/app/(app)/` (signed in), `src/app/login`, `src/app/register` |
| UI | `src/components/` (`ui/Sheet`, `ui/Money`, `shell/*`, `transactions/*`, `settlements/*`, `admin/*`) |
| Setup script | `scripts/create-admin.ts` (`pnpm create-admin`) |

**Rules that bite**
- **Access:** every service takes an `Actor` and checks access itself. A
  tab the actor may not see is "not found", never "forbidden". Add a case
  to `tests/db/access.test.ts` for any new read or write.
- **Mongoose:** `sanitizeFilter` is on globally, so your own operators
  inside a filter value (e.g. `$in`) need `mongoose.trusted(...)`, or
  they're silently neutralised. Aggregation pipelines are unaffected.
- **React:** when alternative footers or confirm rows replace each
  other in the same slot, give each variant a `key`. Otherwise React
  reuses a `type="button"` as a `type="submit"` mid-click and the form
  submits.
- **Forms:** don't disable a submit button based on client state that
  only exists after hydration (a phone that types before scripts load
  gets stuck). Validate on submit instead.
- **Next.js 16:** `middleware.ts` is `proxy.ts`. Page files may only
  export what Next allows. Read `node_modules/next/dist/docs/` first.

## How it was verified

- **Automated:** `pnpm check` covers:
  - money and engine edge cases (reciprocal debts, zero balances,
    decimals, duplicate descriptions, payments);
  - split rounding and per-person totals;
  - schemas and services against an in-memory MongoDB;
  - sessions and throttling;
  - **authorization**: another user can't read or change a tab by id;
    an admin can read but not write.
- **Browser runs:** production builds over the LAN IP, in Edge (and
  WebKit for the phone sheet), phone and desktop sizes:

  | Area | Result |
  |------|--------|
  | Transactions | 39/39 |
  | Settlements | 13/13 |
  | Payments, split and phone entry | 28/28 |
  | Account flows | 31/31 |
  | Sign out | 9/9 |
  | Phone sheet (WebKit and Chromium) | 10/10 |

  Every run included touch audits (44 px, hit-testable, no sideways
  page scroll) and found zero console or CSP errors.
- **Scripts aren't in the repo.** They live in session scratchpad folders
  under `%LOCALAPPDATA%\Temp\claude\c--utang-club\` and will be lost.
  The `playwright-core` install, with WebKit, is in an earlier session's
  `scratchpad/e2e`. Porting them is Phase 8.
- **Not verified:** a real phone. The phone sheet was rebuilt after the
  owner reported it sat at the bottom and misbehaved. Emulation can't
  show an on-screen keyboard, so the keyboard behaviour (the likely
  cause) still needs a check on the owner's phone.

## Loose ends

1. **Owner setup:** run `pnpm create-admin` with their email (`SETUP.md`
   step 5). Their `.env.local` still contains `ACTION_ALLOWED_ORIGINS=*`.
   That should be emptied, more so now that registration is open.
2. **Local data:** `.data/mongo` holds test tabs from early runs. Wipe it
   for a clean start (`SETUP.md` → *Starting fresh*).
3. **Port conflicts on the owner's machine:** a MongoDB Windows service
   had been listening on 27017 alongside `pnpm db:local`. `db:local` now
   refuses to start a duplicate and explains why.
4. **Hydration race:** forms without a Server Action `action` (e.g. new
   tab) do a plain page reload if submitted before scripts load. That's
   rare by hand, but converting them to progressive-enhancement forms
   would remove it.
5. **Nav highlight:** when an admin views someone else's tab, the top
   bar highlights "Tabs" rather than "Admin". The breadcrumb is correct.
6. **Known limitations:**
   - Throttling trusts `x-forwarded-for` (spoofable without a trusted
     proxy); the global limit is the backstop.
   - Registration is open to anyone who can reach the app.
   - No audit history of edits and deletes.
   - No notes or date columns, though both are stored.
7. **Open with the owner:** a payment in the reverse direction *adds*
   to the debt (`SETTLEMENT_RULES.md` → *Clarifications*). This has
   never been explicitly confirmed.

## Recommendation: export the summary as an image or PDF

The owner wants to share a tab's result outside the app. Today there is
**Copy summary** (plain text). The recommendation, in priority order:

### 1. Share as image (PNG): build this first

Group chats (Messenger, Viber) are where the summary goes. An image
reads well there, can't be garbled by chat formatting, and looks
deliberate.

**What the image shows** (1080 px wide, height grows with content):
- A navy header with the tab name and "as of 4 October 2026"
  (Asia/Manila).
- Each outstanding pair as a line: "Bea ⟶ Dave ₱642.75".
- **By person** nets: "Klyde gets back ₱759.50", "Dave pays ₱357.25".
- A small footer: "N settled pairs · Made with Utang Club".
- If there are many pairs, cap at about 20 lines plus "and N more"; a
  very long image is unreadable in chat.
- **Default:** no individual transactions, no settled pairs. The owner
  was asked about both and hasn't answered; confirm before building.

**How**
- A route handler at
  `src/app/(app)/tabs/[tabId]/settlements/image/route.ts` returning
  `ImageResponse` from `next/og`. It's built into Next 16; read
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md`.
- **Access:** route handlers don't run the `(app)` layout. The handler
  must call `getSession()` itself, build the `Actor`, and call
  `getSettlements(tabId, actor)`, which already enforces access. Return
  a 404 for anything not visible, the same as the pages. Send
  `Cache-Control: private, no-store`.
- **Data:** reuse `getSettlements` and `buildSummaryText`'s inputs (or a
  small pure `buildShareModel` next to it, unit-tested). Format with
  `formatPhp`. No arithmetic in the route.
- **Fonts:** `ImageResponse` takes only ttf/otf/woff and has a 500 KB
  limit. Next bundles **Geist Regular**, whose character map covers
  **₱**; render once to confirm the glyph actually appears. For a bold
  weight, add one OFL font file (e.g. Geist SemiBold or Inter SemiBold)
  under `src/assets/fonts/` and read it at module scope.
- **Button:** "Share image" on Settlements, next to Copy summary:
  - It fetches the PNG.
  - If `navigator.canShare({ files: [file] })`, it calls
    `navigator.share` to open the phone's share sheet straight to
    Messenger or Viber.
  - Otherwise it downloads the file through an object URL and
    `<a download>`.
  - **Over plain-HTTP LAN the Web Share API doesn't exist**, so it will
    always download there. On iPhone the image opens and the user
    long-presses to save or share. Tell the owner this, and that it
    becomes one tap once the app is behind HTTPS.
- **Tests:**
  - The pure share model (unit).
  - Route access: 200 `image/png` for the owner and an admin; 404 for
    another user and for signed-out requests.
  - A browser check that the image downloads and the button passes the
    touch audit.

### 2. PDF: use a print layout, not a PDF library

For people who want a document (records, reimbursement), add **Print /
Save as PDF** rather than generating PDFs on the server.

- **`@media print` styles:**
  - Hide the app bar, section nav, buttons and banners.
  - Black on white, with the tab name, date and owner at the top.
  - Avoid page breaks inside a pair (`break-inside: avoid`).
- **Expand everything for print.** Cards are `<details>`, so on
  `beforeprint` set every one to `open`, and restore on `afterprint`.
  Include the line items in print; paper is where the full detail
  belongs.
- **Button:** calls `window.print()`. This works on desktop and phones;
  on iPhone, Share → Print → pinch out gives a PDF.
- **Why not a library:** headless-browser PDF (Playwright/Puppeteer)
  means a large dependency and an emulated Chromium on this Windows ARM
  machine. `@react-pdf/renderer` or `pdfkit` means a second layout to
  keep in sync, plus font work for ₱. The print stylesheet costs a few
  dozen lines and stays in sync with the page automatically.

### 3. CSV export: small and optional

"Download CSV" of every transaction plus the pair totals, for
spreadsheets.
- A route handler with the same access rule as the image.
- RFC 4180 quoting.
- **Formula-injection guard:** prefix a `'` to any cell starting with
  `=`, `+`, `-` or `@`, since descriptions are user text.
- Amounts as plain decimals (`1234.56`) from `minorToDecimalString`.

**Suggested order:** image (most useful for the owner's group chats),
then the print layout, then CSV if anyone asks.

## Next after export: Phase 8, hardening

- Port the browser scripts into a committed Playwright suite
  (`@playwright/test`):
  - LAN IP as `baseURL`;
  - Chromium and WebKit projects;
  - the touch audit, which skips disabled controls, closed `<details>`
    and off-screen elements;
  - an `innerWidth` check;
  - **wait for page content, not the "load" event** (WebKit doesn't
    fire "load" for in-app navigation);
  - **reset the database between runs**, because the registration limit
    (5 per device per 15 minutes) trips repeated runs.
- `loading.tsx` / `error.tsx`, an accessibility pass, and backups (a
  dated `mongodump` script).

## Running it

See **`SETUP.md`**. In short:

```sh
pnpm install
pnpm db:local        # terminal 1, leave running
pnpm create-admin    # once
pnpm dev             # terminal 2: http://localhost:3000 or http://<LAN-IP>:3000
pnpm check           # typecheck + lint + tests
```
