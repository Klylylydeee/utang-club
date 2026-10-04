# AGENTS.md --- Utang Club

## Project

Build a personal utang-club web application that converts
transaction-level expense records into clear person-to-person settlement
summaries.

The source of truth for product behavior is: - `REQUIREMENTS.md` for
product scope and acceptance criteria. - `SETTLEMENT_RULES.md` for
financial/netting logic. - `DATA_MODEL.md` for MongoDB entities and
field semantics. - `ARCHITECTURE.md` for technical boundaries. -
`UI_SPEC.md` for screens and interaction behavior. - `TESTING.md` for
required verification.

Do not read every document for trivial edits. Read only the documents
relevant to the task.

## Stack

-   Next.js with App Router
-   TypeScript
-   MongoDB
-   Mongoose
-   React
-   Tailwind CSS
-   Prefer Server Components by default; use Client Components only when
    interactivity requires them.
-   Use Zod for request/form validation.
-   Use Decimal128 or integer centavos for persisted money. Never use
    JavaScript floating-point arithmetic for financial calculations.

## Brand and visual direction

The application is called **Utang Club**.

The UI should follow Apple-inspired design principles without copying
Apple's proprietary assets or interfaces: - Minimal, calm, content-first
layouts. - Generous whitespace and clear visual hierarchy. - Refined
typography using a system-font stack (`-apple-system`,
`BlinkMacSystemFont`, `Inter`, `Segoe UI`, sans-serif). - Subtle
borders, restrained shadows, soft corner radii, and light use of
translucency/blur where it improves hierarchy. - Prefer neutral surfaces
with one restrained accent color. - Smooth, purposeful
micro-interactions; avoid excessive animation. - Controls should feel
precise, spacious, and touch-friendly. - Progressive disclosure: keep
the default screen simple and reveal transaction detail when needed. -
Strong accessibility, contrast, keyboard navigation, and reduced-motion
support. - Responsive behavior should feel intentionally designed on
desktop and mobile. - Avoid visual clutter, dense dashboard chrome,
excessive gradients, neon colors, or generic admin-template styling.

Utang Club should feel like a polished personal finance utility:
friendly and modern, but not like a bank or enterprise accounting
product.

**Override (owner request, 2026-10-04, PHASING.md D18):** the whole app,
including sign-in, now uses an *enterprise* look: a navy app bar, cool
slate neutrals, crisp hairlines, 10px/8px radii, page headers with
breadcrumbs, and tables for admin data. The rules above about
accessibility, touch, one accent colour, calm motion and no clutter
still apply.

## Core domain language

A transaction has: - `description` - optional `foreignAmount` - optional
`foreignCurrency` - `amountPhp` - `payer` / `toPay`: the person who owes
the money - `recipient` / `toBePaid`: the person who should receive the
money

Example: `Mineral Water | ₱123.03 | Adrian | Klyde` means **Adrian owes
Klyde ₱123.03**.

## Settlement behavior

The app must: 1. Store the original transaction rows without destroying
their audit trail. 2. Group transactions by directed pair: debtor -\>
creditor. 3. Net reciprocal obligations between the same two people. 4.
Produce a final settlement amount and direction. 5. Preserve the
underlying line items so a user can expand a settlement and see why it
exists. 6. Treat payments/balance transfers as transactions that reduce
an obligation when entered in the reverse direction. 7. Round only
according to the rules in `SETTLEMENT_RULES.md`.

Do not implement global debt simplification across unrelated people
unless the user explicitly enables that feature later. The MVP uses
pairwise netting so the summary remains traceable to the original rows.

## Coding expectations

-   Keep domain calculations in pure functions under
    `src/lib/settlement/`.
-   Do not place settlement arithmetic directly in React components or
    route handlers.
-   Use typed DTOs between database, server actions/API routes, and UI.
-   Validate all writes server-side.
-   Avoid `any`.
-   Keep components small and domain names explicit.
-   Add tests whenever settlement behavior changes.
-   Do not silently change financial rules to make a test pass.

## Suggested project structure

``` text
src/
  app/
    page.tsx
    tabs/
      [tabId]/
        page.tsx
        transactions/
        settlements/
    api/
  components/
    transactions/
    settlements/
    people/
  lib/
    db/
    settlement/
      calculatePairwiseSettlements.ts
      money.ts
      types.ts
  models/
    Person.ts
    Tab.ts
    Transaction.ts
  schemas/
    transaction.ts
tests/
  settlement/
```

## Database

-   Keep MongoDB connection code centralized.
-   Add indexes for tab, payer, recipient, and createdAt where useful.
-   Store references using ObjectId, not duplicated person names as the
    canonical relationship.
-   A person's display name may change without corrupting historical
    relationships.

## Money

Prefer integer centavos internally: - ₱123.03 -\> `12303` - ₱1,095.00
-\> `109500`

Formatting belongs at the UI boundary.

If MongoDB Decimal128 is used instead, convert through a dedicated money
utility and never through imprecise binary floating-point calculations.

## UX

The primary workflow is: 1. Open a tab for an activity (a trip, a night out, a dinner). 2. Add
people. 3. Enter transaction rows in a spreadsheet-like table. 4. View
automatically calculated settlement cards. 5. Expand a card to see the
line items that produced the balance. 6. Optionally record a
payment/balance transfer. 7. Recalculate the remaining balance.

Favor fast keyboard entry. The transaction table is the primary input
surface.

## Changes and planning

For a small, localized task, implement directly.

For a multi-file feature, schema migration, settlement-rule change, or
significant refactor: 1. Create/update `PLAN.md`. 2. State assumptions
and affected files. 3. Implement in small milestones. 4. Run the
relevant checks after each milestone. 5. Update documentation when
behavior changes.

## Validation

Before considering a feature complete: - TypeScript must compile. - Lint
must pass. - Relevant automated tests must pass. - Settlement
calculations must be tested with reciprocal debts, zero balances,
decimals, duplicate descriptions, and payment transfers. - Never delete
or overwrite user transaction history merely because the calculated
balance becomes zero. - Every interactive element must work by touch
from a phone or other device on the LAN, in both dev and production
builds, over HTTP or HTTPS. See `UI_SPEC.md` → *Mobile and
external-device access* and `TESTING.md` → *External-device and touch
tests*.

## Security

-   Never commit `.env.local`, MongoDB credentials, secrets, or
    production connection strings.
-   Treat all browser input as untrusted.
-   Do not expose server-only environment variables to the client.
-   Escape/render user-provided descriptions safely.
-   Define every Server Action with `authedAction()`
    (`src/lib/auth/authedAction.ts`). It checks the session against the
    database before validating input. `tests/auth/actionsAreAuthed.test.ts`
    fails if an action skips it; the login action is the only exemption.
-   Pages under `src/app/(app)/` are protected by `requireSession()` in
    that group's layout. `src/proxy.ts` only redirects cookie-less
    requests and sets the CSP nonce; it is not the security boundary.

## Scope discipline

Do not add authentication, multi-currency conversion APIs, OCR, AI
extraction, payment integrations, or complex accounting features unless
explicitly requested.

**Exception (owner requests, 2026-10-03 and 2026-10-04, PHASING.md
D11–D17):** the app has user accounts with open registration (email and
password), database-backed sessions, and two roles. A `user` sees
their own tabs and tabs shared with them; an `admin` can view every tab
(read-only) and manage users. Keep this, but do not add OAuth, email
sending (verification or reset), or more roles unless asked.

**Shared tabs (owner request, 2026-10-04, PHASING.md D19):** an owner
shares a tab with another account by email, choosing `viewer` or
`editor` (`TabShare`). Editors change what's inside a tab
(`loadWritableTab`); renaming, archiving and sharing stay with the owner
(`loadOwnedTab`). Don't add share links, pending invites for emails
without an account, or re-sharing unless asked.

Every domain service takes an `Actor` (`src/lib/auth/actor.ts`) and
checks access itself (`loadReadableTab`, `loadOwnedTab`,
`loadWritableTab` in `src/lib/tabs/tabService.ts`). A tab the actor
may not see is "not found", never "forbidden". Add an access test in
`tests/db/access.test.ts` for any new read or write.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
