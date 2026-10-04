# Phasing --- Utang Club MVP

This file breaks the work in `PLAN.md` into phases. Each phase has a
scope, a list of files, and exit criteria. A phase is only done when
its exit criteria pass. The checks are typecheck, lint and the relevant
tests.

Product behaviour is defined in `REQUIREMENTS.md`,
`SETTLEMENT_RULES.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `UI_SPEC.md`
and `TESTING.md`. If this file conflicts with one of them, that
document wins. Record the conflict in the decision log below.

## Working decisions

These defaults fill gaps the specs don't cover. Change them here before
the phase that depends on them starts.

| \# | Topic | Decision | Phase affected |
|----|-------|----------|----------------|
| D1 | Overpayment | Allowed. If a payment is larger than the amount owed, the debt flips direction, as `SETTLEMENT_RULES.md` implies. The payment dialog warns before saving. | 2, 7 |
| D2 | Engine output | The engine also returns pairs that net to zero (`amountPhpCentavos: 0`), so they can appear as "Settled". Its input includes `transactionDate` and `createdAt`, used to order line items. Cards are sorted by display name in a separate step that receives a map from person ID to name. | 2, 6 |
| D3 | Foreign amounts | `foreignAmountMinor` uses the decimal places of the ISO 4217 currency (JPY = 0, KWD = 3, default 2), taken from a small built-in table. Foreign amounts are only displayed and never enter settlement maths. | 1, 5 |
| D4 | Amount sign | Both `expense` and `payment` require an amount above zero. Direction comes only from who is payer and who is recipient. | 1, 5, 7 |
| D5 | Deleting a person | Not allowed while that person appears in any transaction. Renaming is always allowed. | 4 |
| D6 | Archived tabs | Read-only: they can be viewed and unarchived, but not edited. | 4 |
| D7 | Payment amount | Pre-filled with the full outstanding amount and editable, so partial payments are possible. | 7 |
| D8 | Tooling | pnpm, Vitest for unit and integration tests, `mongodb-memory-server` for integration tests, Playwright for touch and device tests, ESLint (Next.js config). | 1, 8 |
| D9 | Mutations | Server Actions, not route handlers, since no external API is needed. | 4--7 |
| D10 | Version control | Run `git init` before Phase 1. Each phase is one commit or more. | 0 |
| D11 | Access control | A single owner password protects the whole app. There are no user accounts. Requested by the owner on 2026-10-03, which overrides the "no authentication" line in `AGENTS.md` for this gate only. | 3 |
| D12 | Sessions | Sessions are stored on the server in MongoDB (a TTL index expires them). The browser cookie holds only a random token. This allows real logout, "log out everywhere", and automatic logout when the password changes. | 3 |
| D13 | Password storage | Never stored in plain text. The env holds only a scrypt hash, made by a local script. The password is changed by replacing the hash. There is no email-based reset. | 3 |
| D15 | Accounts | Users register with email and password; passwords are scrypt hashes in the `users` collection. Sessions belong to a user and end when their password changes or the account is disabled. Supersedes the single owner password (D11, D13). No emails are sent. | 9 |
| D16 | Registration | Open: anyone who can reach the app can register a regular account. Throttled per device. | 9 |
| D17 | Roles | `user` sees only their own tabs. `admin` can view every tab (read-only) and manage users (disable, role, set password), but can't change their own account. | 9 |
| D18 | Visual direction | An enterprise look everywhere, overriding "not like a bank or enterprise product" in AGENTS.md: navy app bar, slate neutrals, hairlines, 10/8px radii, breadcrumbs, admin tables. | 9 |
| D14 | External-device access | Everything must work by touch from phones and LAN devices, in dev and production builds, over HTTP or HTTPS (`UI_SPEC.md` → *Mobile and external-device access*). Settings that depend on the transport (cookie `Secure`/`__Host-`, HSTS, `upgrade-insecure-requests`) follow the protocol of the actual request, not `NODE_ENV`. | 1, 3, 4--8 |

## Phase 0 --- Repository setup

-   `git init`, initial commit containing the existing docs.
-   Confirm or adjust D1--D13.

**Exit:** the repo exists and the decisions are agreed.

## Phase 1 --- Bootstrap (PLAN Milestone 1) --- ✅ done 2026-10-03

Scope:

-   Next.js (App Router, TypeScript strict) with Tailwind and ESLint.
-   Server-only environment check using Zod (`MONGODB_URI`, plus the
    auth variables from Phase 3). Any module that reads secrets imports
    `server-only`, so it can never end up in the client bundle.
-   One central Mongoose connection with a cached connection for dev
    hot reload.
-   Models: `Tab`, `Person`, `Transaction` with the indexes from
    `DATA_MODEL.md`. Schemas are strict, and `sanitizeFilter` is on
    globally to block NoSQL operator injection.
-   Zod schemas for tab, person and transaction input. ObjectId
    parameters are validated before any query runs.
-   Security baseline in `next.config.ts`: `poweredByHeader: false` and
    the static security headers (see Phase 3, security headers).
-   App shell: the "Utang Club" header, the system font stack, colour
    tokens for light and dark mode, and reduced-motion support.
-   LAN access (D14): `dev` and `start` scripts run with
    `-H 0.0.0.0`. `allowedDevOrigins` lists this machine's LAN IPs
    automatically, plus any in `DEV_ALLOWED_ORIGINS`. Viewport meta and
    the base touch styles (16 px inputs, `touch-action: manipulation`,
    safe-area insets) are set up front.

Files:

``` text
src/app/layout.tsx, src/app/page.tsx, src/app/globals.css
src/lib/env.ts
src/lib/db/connect.ts
src/models/Tab.ts, Person.ts, Transaction.ts
src/schemas/tab.ts, person.ts, transaction.ts
next.config.ts, vitest.config.ts
```

**Exit:** `pnpm dev` starts. The app connects to the configured
database. `pnpm typecheck` and `pnpm lint` pass. A phone on the same
Wi-Fi opens `http://<LAN-IP>:3000`, and a test button on the page
responds to taps under both `pnpm dev` and `pnpm start`.

## Phase 2 --- Settlement engine (PLAN Milestone 2) --- ✅ done 2026-10-03

Scope:

-   `money.ts`: convert between pesos and centavos (strings only, no
    floats), add and subtract in integer centavos, format as
    `₱12,345.67`, and validate input strings.
-   `types.ts`: `SettlementInput` and `PairwiseSettlement` (extended
    per D2).
-   `calculatePairwiseSettlements.ts`: a pure, deterministic function
    that nets each pair of people.
-   `orderSettlements.ts`: sorts cards by debtor name, then creditor
    name.
-   Every engine test listed in `TESTING.md`, plus tests for duplicate
    descriptions, overpayment reversal (D1) and malformed money input.

Files:

``` text
src/lib/settlement/money.ts
src/lib/settlement/types.ts
src/lib/settlement/calculatePairwiseSettlements.ts
src/lib/settlement/orderSettlements.ts
tests/settlement/*.test.ts
```

**Exit:** `pnpm test tests/settlement` passes without a database and
without React.

## Phase 3 --- Access gate and security hardening --- ✅ done 2026-10-04

This comes before any data-entry screen, so every page and action is
written with the gate already in place.

### Password and login

-   `scripts/hash-password.ts` asks for the password without echoing
    it and prints a scrypt hash string (`scrypt:N:r:p:salt:hash`; colons because Next.js expands `$NAME` in `.env` values) to
    paste into `AUTH_PASSWORD_HASH`. It enforces a minimum of 12
    characters.
-   The login check uses Node `crypto.scrypt` and compares with
    `timingSafeEqual`. The same generic error appears whatever went
    wrong, and failed attempts take the same time as successful ones.
-   A `/login` page posts to a Server Action. Nothing else is reachable
    without a session.

### Sessions (D12)

-   On login the app creates a random 32-byte token. The cookie stores
    the token. MongoDB stores only its SHA-256 hash, in a `sessions`
    collection with `expiresAt` (a TTL index deletes old ones),
    `lastSeenAt`, and a fingerprint of the current password hash.
-   Cookie: `HttpOnly`, `SameSite=Strict`, `Path=/`. It expires after
    7 days without use, with a hard limit of 30 days. The cookie uses
    the `__Host-` prefix and `Secure` **when the request arrived over
    HTTPS** (checked via `x-forwarded-proto`). Over plain-HTTP LAN it
    uses neither, because browsers would silently drop the cookie (D14).
    The login page shows a "not a secure connection" notice in that
    case.
-   A new token is issued at every login, which prevents session
    fixation.
-   Logout is a POST action that deletes the session record and clears
    the cookie. "Log out everywhere" deletes every session.
-   Sessions whose password fingerprint no longer matches the current
    hash are rejected. Changing the password therefore logs out every
    device.

### Enforcement in two layers

-   `src/proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`)
    sends requests without a session cookie to `/login`. It only does
    this quick redirect and is **not** the security boundary.
-   `requireSession()` is the real check. It looks up the session in
    MongoDB and is called by the protected layout and **at the start of
    every Server Action**. Every action is wrapped in an
    `authedAction()` helper, so forgetting the check is a lint/test
    failure, not a silent hole.

### Brute-force protection

-   A `loginAttempts` collection keyed by a hashed client IP (with a
    TTL index). After 5 failures within 15 minutes, that IP is locked
    out and the wait grows exponentially, capped at 1 hour.
-   A global limit as well: after 20 failures within 15 minutes from
    any IP, all logins are locked briefly. This stops a distributed
    guessing attack.
-   Locked-out responses look the same as normal failures and don't
    reveal how many attempts remain.

### CSRF and request integrity

-   Server Actions already check that the Origin header matches the
    Host. A direct LAN IP passes this check as is.
    `serverActions.allowedOrigins` comes only from
    `ACTION_ALLOWED_ORIGINS` (empty by default), which is for tunnels
    or reverse proxies.
-   A `SameSite=Strict` cookie, and no state-changing GET routes.
-   Zod caps body size and string lengths (description ≤ 200
    characters, notes ≤ 1,000, names ≤ 60).

### Security headers

-   Content-Security-Policy with a per-request nonce:
    `default-src 'self'`,
    `script-src 'self' 'nonce-…' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`,
    `connect-src 'self'`, `frame-ancestors 'none'`,
    `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`.
-   Dev only: `'unsafe-eval'` in `script-src`, and `ws:`/`wss:` in
    `connect-src`, for hot reload. Production keeps the strict policy.
-   `Strict-Transport-Security: max-age=63072000; includeSubDomains`
    and `upgrade-insecure-requests` are sent **only on HTTPS
    responses**. Sending them over HTTP LAN would break every asset on
    the phone (D14).
-   `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`,
    `X-Frame-Options: DENY`, and a `Permissions-Policy` that turns off
    camera, microphone and geolocation.
-   `Cache-Control: no-store` on authenticated pages.

### Output and error handling

-   React escapes user text by default. `dangerouslySetInnerHTML` is
    banned via a lint rule.
-   In production, users see generic error messages. Detailed errors go
    only to the server logs, which never contain passwords, tokens or
    connection strings.
-   Data sent to the browser is limited to typed DTOs that never
    include internal fields.

### Operations (documented in the README, not code)

-   MongoDB: a dedicated database user that can access only the
    `utang-club` database, TLS required, and an Atlas IP allowlist
    where possible.
-   Secrets live only in `.env.local` and the hosting provider's
    environment settings. `.env.example` lists placeholder names only.
-   Run `pnpm audit` as part of the checks for each phase. Pin the
    package manager version and keep the lockfile committed.

New environment variables (added to `.env.example` as placeholders):

``` text
AUTH_PASSWORD_HASH=      # output of pnpm hash-password
AUTH_SECRET=             # ≥ 32 random chars; only hashes client IPs (renamed, see log)
DEV_ALLOWED_ORIGINS=     # optional, comma-separated extra dev hosts
ACTION_ALLOWED_ORIGINS=  # optional, tunnel/proxy hosts for Server Actions
```

Files:

``` text
scripts/hash-password.ts
src/lib/auth/password.ts        # scrypt hash/verify
src/lib/auth/session.ts         # create/verify/revoke, requireSession()
src/lib/auth/rateLimit.ts       # loginAttempts logic
src/lib/auth/authedAction.ts    # Server Action wrapper
src/models/Session.ts, LoginAttempt.ts
src/app/login/page.tsx, src/app/login/actions.ts
src/proxy.ts                    # redirect + CSP nonce
next.config.ts                  # static headers
tests/auth/*.test.ts
```

Tests:

-   Unit: hashing and verifying passwords (correct password, wrong
    password, malformed hash), token hashing, lockout and backoff
    maths.
-   Integration: unauthenticated pages redirect to `/login`, and
    unauthenticated Server Actions are rejected. Lockout starts after
    5 failures. After logout the old cookie is useless. Changing the
    password invalidates existing sessions. Expired sessions are
    rejected. Logging in over plain HTTP via the LAN IP sets the cookie
    and keeps the session, under both dev and production builds.

**Exit:** nothing except `/login` and static assets is reachable
without a valid session. The auth tests pass. A header scan (for
example securityheaders.com or `curl -I`) shows every header listed
above.

## Phase 4 --- Tabs and participants (PLAN Milestone 3) --- ✅ done 2026-10-04

Scope:

-   Server actions, all wrapped in `authedAction()`: `createTab`,
    `updateTab` (rename, archive and unarchive), `addPerson`,
    `updatePerson`.
-   Duplicate-name check that ignores case, enforced both by the unique
    index on `normalizedName` and by a readable error message.
-   D5 (person deletion) and D6 (archived tabs are read-only),
    enforced on the server.
-   Pages: the tab list at `/`, `/tabs/new`, and the tab header at
    `/tabs/[tabId]` showing name, participant count, transaction
    count and the Transactions | Settlements section switcher. The app shell
    includes a logout control.

**Exit:** a user can create a tab, add Adrian and Klyde, and gets an
error when adding "adrian". Validation tests pass.

## Phase 5 --- Transaction entry (PLAN Milestone 4) --- ✅ done 2026-10-04

Scope:

-   Server actions: `createTransaction`, `updateTransaction`,
    `deleteTransaction` (with confirmation), and duplicating a row.
    Every action checks that the payer and recipient belong to the
    tab in the request.
-   A table you edit like a spreadsheet, as a Client Component:
    keyboard navigation (Tab, Enter, arrow keys where practical),
    dropdowns to pick a participant, right-aligned amounts, foreign
    fields hidden until needed, and a visible saved / saving / error
    state per row.
-   Optimistic updates that are visibly rolled back if a save fails.
    Unsaved edits are never discarded silently. If the session expires
    mid-edit, the edits are kept and the user is sent to log in again.
-   Validation tests from `TESTING.md`: amount ≤ 0, payer equal to
    recipient, missing payer, recipient or description, malformed
    amount. Also a test that a person from a different tab is
    rejected.
-   Horizontal scrolling on narrow screens.

**Exit:** all CRUD works. Validation errors appear next to the field
that caused them. Validation tests pass.

## Phase 6 --- Settlement summary (PLAN Milestone 5) --- ✅ done 2026-10-04

Scope:

-   `getSettlements` service: loads transactions, calls the engine,
    then turns the result into data shaped for the UI using people's
    display names.
-   Settlement cards in a responsive grid. The header shows the net
    direction (`Adrian → Klyde`). Each card expands to its line items,
    and payments and offsets are marked with an icon and label as well
    as colour. The outstanding amount is displayed prominently.
-   Outstanding / Settled toggle (settled pairs are hidden by default).
-   Recalculated whenever a transaction changes (path revalidation).

**Exit:** acceptance criteria 1--4 and 6 in `REQUIREMENTS.md` hold
when checked by hand.

## Phase 7 --- Payments (PLAN Milestone 6) --- ✅ done 2026-10-04

Scope:

-   `recordPayment` action and a dialog opened from a card (D7, D1
    warning).
-   The payment is stored as its own transaction with
    `type: "payment"`. No existing row is changed.

**Exit:** acceptance criterion 5 holds. The manual acceptance flow in
`TESTING.md` passes from start to finish (after logging in).

## Phase 8 --- Hardening (PLAN Milestone 7)

Scope:

-   Integration tests (`mongodb-memory-server`): create a tab and its
    people, then check that adding, editing and deleting an expense
    and recording a payment each update the settlement. All of these
    run through the auth wrapper.
-   Empty, loading (`loading.tsx`) and error (`error.tsx`) states.
-   Accessibility pass: labels, focus rings, keyboard access to table
    actions, contrast, and no status shown by colour alone. Also covers
    the login page.
-   Responsive layout pass on mobile and desktop.
-   Playwright touch and device suite from `TESTING.md` → *External-device
    and touch tests*, run against the LAN IP under both dev and
    production builds. Plus the manual check on real devices (iOS
    Safari, Android Chrome).
-   Final security review: `pnpm audit`, a check that no secrets reach
    the client bundle, a header scan, and a manual check of the CSP
    for any violations.
-   README: setup, generating the password hash, required environment
    variables, the deployment checklist from Phase 3 (operations), and
    "open on your phone" steps (find the LAN IP, allow port 3000
    through the Windows Firewall on private networks).

**Exit:** typecheck, lint, unit tests, integration tests and the
Playwright device suite all pass under both builds. `pnpm audit` shows
no high or critical issues. README is up to date.

## Out of scope

Multiple user accounts, roles, OAuth or social login, two-factor
authentication, email password reset, live FX rates or FX APIs, OCR and
AI extraction, payment integrations, global debt simplification,
CSV/XLSX import (the `source` field stays reserved), and native apps.

## Decision log

Record changes to D1--D13 and any new decisions here, with dates.

-   2026-10-03 --- Initial phasing drafted. D1--D10 proposed.
-   2026-10-03 --- Owner asked for a login with enhanced security. Added
    D11--D13 and Phase 3 (access gate and security hardening). Later
    phases were renumbered; PLAN milestone numbers are unchanged.
    `AGENTS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md` and `README.md`
    will be updated in Phase 3 to describe the gate.
-   2026-10-03 --- Owner required that everything be tappable from
    phones and external devices in both dev and production builds.
    Added D14. The rules are in `UI_SPEC.md` and the tests in
    `TESTING.md`, and `AGENTS.md` Validation references both. The
    Phase 3 cookie and HSTS settings now depend on the request
    protocol, not `NODE_ENV`.
-   2026-10-03 --- Phase 1 complete. Notes:
    -   Scaffolded with Next.js 16.3, React 19.2, Mongoose 9, Zod 4 and
        Vitest 5. In Next.js 16 the request hook is `src/proxy.ts`
        (formerly `middleware.ts`), and Phase 3 now uses that name.
    -   `parseMoneyToMinor` (string to integer minor units) was brought
        forward from Phase 2 into `src/lib/settlement/money.ts`, because
        the transaction schema needs it. Phase 2 adds the arithmetic,
        the formatting and the engine.
    -   The ISO 4217 minor-unit table for D3 is in `src/lib/currency.ts`.
    -   This machine is Windows on ARM, and MongoDB has no native build
        for it. The tests and the new `pnpm db:local` script (a
        persistent local MongoDB in `.data/`, bound to 127.0.0.1 only)
        use the x64 binary under emulation.
    -   `mongodb-memory-server`'s postinstall script is disabled in
        `pnpm-workspace.yaml`. The binary downloads on first use.
-   2026-10-03 --- Phase 2 complete. The settlement engine clarifies
    these rules (also recorded in `SETTLEMENT_RULES.md` →
    *Clarifications*):
    -   A payment in the reverse direction *increases* the debt. If
        Klyde pays Adrian while Adrian owes Klyde, Adrian now owes Klyde
        that amount too. This follows directly from "payments decrease
        payer → recipient".
    -   Rows without a `transactionDate` are ordered by their
        `createdAt`.
    -   A settled pair keeps its line items and is oriented
        alphabetically by display name.
    -   The engine throws on invalid rows (self-transactions, amounts
        that are not positive integers, overflow) instead of skipping
        them. Validation must stop such rows before they reach it.
    -   Each settlement also returns signed `effectCentavos` per line
        item and a four-part `breakdown`. The UI can then show why a
        balance exists without doing any arithmetic itself.
-   2026-10-03 --- **Renamed "Trip" to "Tab"** at the owner's request.
    Expenses are grouped by month or any period, not only by trips. In
    code this means the `Tab` model and `tabId` field, routes under
    `/tabs/...`, and new tabs default to the current month's name
    (Asia/Manila). UI navigation between Transactions and Settlements
    is called a "section", never a "tab". The home page's
    database-status card was removed at the owner's request.
-   2026-10-04 --- Phases 3 and 4 complete. Notes:
    -   `AUTH_COOKIE_SECRET` was renamed **`AUTH_SECRET`** and is used
        only to HMAC client IPs for the login throttle. It is **not** a
        password pepper, so changing the password (replacing
        `AUTH_PASSWORD_HASH`) never depends on the secret, and rotating
        the secret only resets throttle counters.
    -   The models are `Session` and `LoginThrottle` (the plan said
        `LoginAttempt`). The throttle is split into a pure
        `throttlePolicy.ts` and a `throttleStore.ts`.
    -   Proxy's matcher skips prefetch requests. That's safe because the
        `(app)` layout's `requireSession()` re-checks on every render.
    -   Proxy redirects only GET requests. A Server Action POST without
        a session gets `{ code: "unauthenticated" }` from
        `authedAction`, so the client can keep unsaved input.
    -   `AGENTS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `README.md` and
        `.env.example` now describe the gate.
-   2026-10-04 --- Phase 5 complete. Decisions made along the way:
    -   **Saving:** a saved row saves when focus leaves the row (or on
        Enter, which moves down a row). The entry row at the bottom is
        only saved on Enter or "Add", so tapping elsewhere never creates
        a half-typed row.
    -   **"Rolled back visibly"** applies to what's *saved*: a failed
        delete puts the row back with a message, and a failed create
        returns the row above the entry row. A failed *edit* keeps what
        the user typed, marked "Not saved", with "Undo my changes",
        because unsaved edits must never be discarded silently.
    -   **Session expiry and navigation:** unsaved input is mirrored to
        `sessionStorage` per tab and restored on return, so signing in
        again (or reloading, or switching sections) loses nothing. A
        `beforeunload` warning covers closing the browser tab.
    -   **Validation** runs the same Zod schema in the browser for
        instant field errors; the server re-validates every write. The
        PHP amount and payer ≠ recipient checks now report together with
        the other field errors in one pass.
    -   **Narrow screens:** the table scrolls horizontally inside its
        card (the bottom-sheet editor in `UI_SPEC.md` is optional and
        not built). The scroll box must be `position: relative`, or
        Tailwind's absolutely-positioned `sr-only` text escapes the clip
        and widens the whole page on phones.
    -   Notes and transaction date are stored and carried through edits
        but have no table columns yet.
    -   Duplicate copies the row's *saved* values, not unsaved edits.
-   2026-10-04 --- Phase 6 complete (the owner asked for "a summary per
    Person 1 → Person 2", which is this section). Notes:
    -   `buildSettlementSummary` (pure, in `src/lib/settlements/`) maps
        the engine output to cards; `getSettlements` loads and calls it.
        The owed / offsets-and-payments subtotals are summed there, so
        the UI does no arithmetic.
    -   The "Outstanding / Settled toggle" is a collapsed "Settled (n
        pairs)" disclosure below the outstanding cards: hidden by
        default, no client JavaScript.
    -   Cards and the settled section are native `<details>`, so they
        expand by touch and keyboard without hydration. Nested groups
        need named Tailwind groups (`group/card`), or inner arrows
        follow the outer one.
    -   Line items say "Offset", "Payment" or "Paid back" in text with a
        glyph; colour is only a secondary cue.
    -   The app content width went from `max-w-5xl` to `max-w-6xl` so
        the full transaction table fits at 1280 px without scrolling.
    -   The "Record payment" button on cards is left for Phase 7.
-   2026-10-04 --- Phase 7 complete, plus four owner requests (PLAN
    milestone 6b): split a bill, copy summary, phone entry, per-person
    totals. Notes:
    -   **Split rounding (owner decision):** leftover centavos go one
        each to the debtors in name order; the payer is ticked by
        default. Recorded in `SETTLEMENT_RULES.md` → *Splitting a bill*.
        Each split row carries a note ("Split of ₱100.00 between 3
        people, paid by Klyde").
    -   **Record payment** stores a `type: "payment"` row debtor →
        creditor. D1: the server refuses an amount above what is owed
        with a `conflict` result; the sheet then offers "Save anyway".
    -   **Copy summary** uses the Clipboard API on HTTPS and falls back
        to a selectable text box on plain-HTTP LAN (no clipboard there).
        No share links.
    -   **Phone entry:** below `md` the table is replaced by a row list
        and a bottom-sheet editor (`TransactionSheet`). Both are
        rendered and switched with CSS. The hidden table's draft
        restore still runs on phones; harmless, but drafts typed on
        desktop won't show in the phone list.
    -   **Per-person totals** only add up each person's outstanding
        pairs (`calculatePersonTotals`); payments still go pair by pair.
    -   **Bug found in browser testing:** when two alternative footers
        render in the same slot, React reuses a `type="button"` element
        as the `type="submit"` one *during* the click, and the browser
        then submits the form ("Keep editing" saved the edit). Footer
        variants are now keyed. Watch for this pattern anywhere a
        confirm row replaces a form's buttons.
-   2026-10-04 --- Design pass (owner asked to "fix all the UI" with the
    frontend-design skill). Within the AGENTS.md brief (system fonts,
    neutral surfaces, one accent):
    -   **Accent is ballpen blue** (`#3341a8` light, `#8e9bff` dark),
        after the blue ink of the listahan (the utang notebook), for
        actions only. Green now means only "money comes back / settled";
        red only errors and destructive actions. Before, one green meant
        "Add", "Gets back" and "Settled".
    -   **Amounts lead:** a `Money` component sets the ₱ smaller and
        quieter with tabular figures. The settlement card amount (34px)
        is the one bold element; the card names read as a sentence with
        a drawn arrow.
    -   **Hierarchy over identical cards:** outstanding cards are raised;
        settled cards lie flat. The tab list and "By person" are grouped
        lists. Radii by tier: containers 20px, controls 12px, chips
        round.
    -   Smaller fixes: "Saved" clears after 2.5 s; calmer "Not saved"
        and field-error text; one chevron for every `<select>`; no empty
        gap on the login card; counts read "4 people, 8 transactions"
        (no middle dots); the ↑↓ and ÷ glyphs are gone.
-   2026-10-04 --- **Accounts and roles** (owner request; D15–D18), with
    the app repositioned from monthly tabs to activities (trips, nights
    out, dinners). Notes:
    -   Every service takes an `Actor`; a tab the actor may not see is
        "not found" (no probing by id). Admins get a "read-only" error
        when trying to change someone else's tab.
    -   `pnpm create-admin` replaces `pnpm hash-password`. It creates
        or promotes an admin, assigns pre-accounts tabs (no `ownerId`)
        to them, and removes pre-accounts sessions. `AUTH_PASSWORD_HASH`
        is no longer used.
    -   Sign-in throttling is per device and per account (HMAC of the
        email), plus the global budget. Registration has its own budget.
        A disabled account is only revealed after a correct password.
    -   New tabs start with an empty name (activity placeholders) instead
        of the current month.
    -   Known limitation: open registration means anyone on the network
        can create an account. Use an invite code (not built) if the app
        is ever exposed beyond people you trust.
