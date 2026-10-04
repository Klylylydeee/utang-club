# Handoff — Utang Club

*Last updated: 2026-10-04 (after Phase 7 and the owner requests)*

This is a snapshot of where the build stands. `PHASING.md` holds the
full plan, the decisions D1–D14 and the decision log. This file covers
what exists today, what has been verified, and what's still loose.

## Status at a glance

| Phase | Scope | State |
|-------|-------|-------|
| 0 | Repo setup | ✅ First commit made (docs plus Phases 1–4) |
| 1 | Bootstrap (Next.js, Mongo, models, schemas, shell) | ✅ Done |
| 2 | Settlement engine and money helpers | ✅ Done |
| 3 | Login and security hardening | ✅ Done, docs updated |
| 4 | Tabs and people | ✅ Done |
| 5 | Transaction table | ✅ Done, verified in a browser (production build, phone viewport, LAN IP) |
| 6 | Settlement cards | ✅ Done, verified in a browser (acceptance flow 1–6) |
| 7 | Payments, plus split / copy summary / phone entry / per-person totals | ✅ Done, verified in a browser (28/28) |
| 8 | Hardening (Playwright suite, a11y, README) | ⏭️ **Next up** |

`pnpm check` passes: typecheck, lint and **221 tests in 21 files**,
including in-memory MongoDB tests.

## Changes the owner asked for along the way

- **"Trip" became "Tab".** Expenses are grouped by month or any period.
  New tabs default to the current month in Manila ("October 2026"). The
  word "tab" always means a tab of expenses; UI navigation is a
  "section" (see `UI_SPEC.md`).
- **The database-status card was removed** from the home page.
- **A login with strong security was added** (D11–D13). This is an
  explicit exception to the "no auth" line, now recorded in `AGENTS.md`.
- **Everything must work by touch from a phone on the LAN, in dev and
  production builds** (D14).

## What's built

### Phases 1–4 (foundation, engine, access gate, tabs and people)

Unchanged since the last handoff. In short:

- Next.js **16.3** (App Router; `middleware.ts` is **`proxy.ts`**),
  React 19.2, Mongoose 9, Zod 4, Tailwind 4, Vitest 5, pnpm. Read
  `node_modules/next/dist/docs/` before touching Next.js APIs.
- Pure settlement engine in `src/lib/settlement/` (pairwise netting,
  signed line-item effects, four-part breakdown, ordering). Money is
  integer centavos everywhere.
- Owner-password gate: scrypt hash in env, MongoDB sessions, login
  throttle, per-request CSP nonce. `authedAction()` wraps every Server
  Action; a test fails if one isn't wrapped. `ARCHITECTURE.md` → *Access
  gate* and README → *Sign-in* describe it.
- Tabs and people with D5 (no removing people with transactions) and D6
  (archived tabs are read-only) enforced on the server.
- **Mongoose gotcha:** `sanitizeFilter` is on globally, so any query
  operator you write yourself inside a filter value (e.g. `$in`) must be
  wrapped in `mongoose.trusted(...)`, or it's silently neutralised.
  Top-level `$or` and aggregation pipelines are unaffected.

### Phase 5: Transaction entry

- **Schemas** (`src/schemas/transaction.ts`): `transactionInputSchema`,
  plus `transactionUpdateSchema` (same fields + `transactionId`) and
  `transactionRefSchema`. The PHP amount and payer ≠ recipient errors
  are reported in the same pass as the other field errors.
- **Service** (`src/lib/transactions/transactionService.ts`): list (in
  entry order), create, update (replaces all fields, unsets cleared
  optional ones), delete, duplicate. Every write calls
  `loadWritableTab()` (D6). Create and update check that payer and
  recipient both belong to the tab, with per-field errors. Update
  refuses to move a row to another tab.
- **Actions** (`src/actions/transactions.ts`): four `authedAction`s;
  each revalidates `/` and the tab layout, so counts update everywhere.
- **DTO:** `TransactionRow` (`src/lib/transactions/types.ts`).
- **UI** (`src/components/transactions/`):
  - `TransactionTable` (client): the spreadsheet. Enter on the entry row
    adds it and focuses a fresh entry row. Saved rows save when focus
    leaves the row. Enter moves down, ↑/↓ move between rows in text
    columns, and Escape reverts an unsaved edit.
  - Per-row status says Unsaved / Saving / Saved / Not saved, as text
    plus a glyph.
  - Optimistic create/duplicate/delete use `useOptimistic`; a failed
    delete visibly puts the row back.
  - Unsaved input is mirrored to `sessionStorage` and restored, so it
    survives reloads, section switches and an expired session.
  - The same Zod schema runs in the browser (`validateRow.ts`) for
    instant field errors.
  - Foreign-currency columns stay hidden until "Add foreign currency"
    is pressed or any row uses them.
  - `TransactionList` (server): read-only table for archived tabs.
  - `rowValues.ts`: pure helpers between `TransactionRow` and the
    strings in the inputs. `minorToInputString` (in `money.ts`) formats
    `1,234.56` without floats.
- **Page:** `src/app/(app)/tabs/[tabId]/transactions/page.tsx` shows
  "Add people first" when the tab has fewer than two people.
- The decisions behind the save/rollback behaviour are in `PHASING.md`
  → decision log, 2026-10-04 (Phase 5).

## How it was verified

- **`pnpm check`**: everything above, plus new tests for the update and
  ref schemas, `minorToInputString`, row-value helpers and client
  validation, and `tests/db/transactionService.test.ts`. The DB tests
  cover CRUD, people from another tab (per field), archived tabs,
  duplicate descriptions, cross-tab moves, and D5 once rows exist.
- **`pnpm build`** succeeds.
- **Browser flow, Phase 5 (39/39 passed):**
  - **Setup:** a production build (`next start`) on port 3217, opened
    via the LAN IP in Edge at a 390×844 touch viewport. It used
    temporary credentials passed through env vars and a throwaway
    `utang-club-e2e` database, which was dropped afterwards.
  - **Covered:**
    - the empty state with fewer than two people
    - adding rows by Enter and by tapping Add
    - each validation error showing next to its field
    - autosave when leaving a row; edits that survive a reload
    - arrow-key movement and Escape
    - duplicate, and delete with confirmation
    - foreign columns
    - unsaved input restored after a reload
    - an expired session mid-edit (edit kept, sign-in link, retry
      saves after signing in again)
    - tab-list counts, now confirmed against an empty database, which
      resolves the open Phase 4 check
    - the archived read-only table
    - 44 px / hit-testable audits on every state
    - zero console errors and zero CSP violations
  - **Bug found and fixed:** on phones the whole page was 823 px wide,
    because absolutely-positioned `sr-only` text escaped the table's
    scroll box. The scroll box is now `relative`.
  - **Where the scripts are:** `phase5.mjs` is in this session's
    scratchpad, and the Phase 4 `flow.mjs` with its `playwright-core`
    install is in an earlier session's scratchpad. Neither is in the
    repo; see loose end 4.
- **Still not verified:** a real phone, the `pnpm hash-password`
  prompt itself, and the production `Cache-Control` header (not
  checked this time).

## Loose ends

1. **The local database (`.data/`) contains test tabs** from the
   Phase 4 browser runs. Wipe it before real use: stop `pnpm db:local`
   and delete `.data/mongo`.
2. **`.env.local` has no auth values yet.** The owner needs to run
   `pnpm hash-password` and paste both lines in (README → Sign-in).
3. **A dev server was already running on port 3000** during this
   session (not started by the agent), and another project's dev server
   was on port 3100. Use a free port for test servers.
4. **Port the browser flows into the repo** as the Phase 8 Playwright
   suite (`TESTING.md` → *External-device and touch tests*). It needs:
   - `@playwright/test`
   - the LAN IP as `baseURL`
   - the touch audit that skips disabled controls, controls inside
     closed `<details>`, and anything off screen
   - a check that `innerWidth` stays at the device width, because a
     too-wide page makes mobile browsers zoom out and hides the problem
5. **Known limitation:** without a trusted reverse proxy, the client IP
   for the throttle comes from `x-forwarded-for` and can be spoofed. The
   global throttle is the backstop.
6. **Not built yet:** columns for notes and transaction date (both are
   stored and preserved through edits).

### Phase 6: Settlement summary (added after this file's Phase 5 snapshot)

- `src/lib/settlements/buildSettlementSummary.ts` (pure, unit-tested)
  turns rows + people into `SettlementCard`s (`types.ts`) via the
  engine. `settlementService.getSettlements(tabId)` loads and calls it.
- `src/components/settlements/SettlementCardView.tsx`: a server-rendered
  `<details>` card: "Adrian → Klyde ₱23.03", expanding to each row with
  "Offset" / "Payment" / "Paid back" labels, signed amounts and an
  Owed / Offsets and payments / Outstanding summary.
- The Settlements page shows outstanding cards in a grid, with settled
  pairs folded under "Settled (n pairs)".
- Verified: `tests/settlements/` and `tests/db/settlementService.test.ts`,
  plus a browser run of acceptance criteria 1–6 on the production build
  at phone width (13/13; touch audit clean; no console or CSP errors).

### Phase 7 and owner requests

- **Record payment:** a button on each outstanding card opens a sheet
  prefilled with the amount owed (`RecordPaymentButton` →
  `recordPaymentAction` → `paymentService`). Overpaying needs
  "Save anyway" (D1).
- **Split a bill:** on the Transactions page (`SplitBillButton` →
  `splitExpenseAction` → `splitService`), with a live preview from the
  same pure `splitAmount` the server uses.
- **Copy summary:** on the Settlements page (`CopySummaryButton`, text
  from `buildSummaryText`).
- **Phone entry:** `MobileTransactionList` + `TransactionSheet` below
  `md`.
- **By person:** a section on Settlements (`PersonTotalsList`, data
  from `calculatePersonTotals`).
- Shared `Sheet` (native `<dialog>`, a bottom sheet on phones) and
  `Field` helpers live in `src/components/ui/`.
- Browser run (production build, phone width, LAN IP): 28/28. It
  covered acceptance criterion 5, a touch audit of every sheet, and
  two regression checks for the keyed-footer bug (see the `PHASING.md`
  decision log).

## Next: Phase 8, hardening

- Port the scratchpad browser scripts (`phase5.mjs`, `phase6.mjs`,
  `phase7.mjs` in this session's scratchpad) into a committed
  Playwright suite before they're lost.
- `loading.tsx` / `error.tsx` states, an accessibility pass, README.
- Still recommended from the review: backups, an audit trail for edits
  and deletes, removing `ACTION_ALLOWED_ORIGINS=*`, and confirming the
  reverse-payment rule.

## Running it

```sh
pnpm install
pnpm db:local          # terminal 1: local MongoDB (leave running)
pnpm hash-password     # once; paste AUTH_PASSWORD_HASH and AUTH_SECRET into .env.local
pnpm dev               # terminal 2: http://localhost:3000 or http://<LAN-IP>:3000
pnpm check             # typecheck + lint + tests
```

On a phone, open `http://<LAN-IP>:3000` on the same Wi-Fi. If Windows
Firewall asks about Node.js, allow it on private networks only.
