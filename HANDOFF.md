# Handoff — Utang Club

*Last updated: 2026-10-04. Repo: <https://github.com/Klylylydeee/utang-club> (`main`).*

This is a snapshot of where the build stands, for whoever picks it up
next. `PHASING.md` holds the plan, the decisions (D1–D18) and the
decision log. `SETUP.md` explains how to install and run the server.
This file covers what exists, how it was verified, and what's still
loose.

## Status at a glance

| Phase | Scope | State |
|-------|-------|-------|
| 0–4 | Repo, foundation, settlement engine, security, tabs and people | ✅ Done |
| 5 | Transaction entry (desktop spreadsheet, phone list and sheet) | ✅ Done |
| 6 | Settlement cards, by-person totals, copy summary | ✅ Done |
| 7 | Record payment, split a bill | ✅ Done |
| 9 | Accounts, roles, admin area, enterprise look, activity copy (D15–D18) | ✅ Done |
| 6c | Export: share image (PNG), print / save PDF, CSV | ✅ Done |
| 8 | Hardening: Playwright suite, error/loading states, a11y, backups | ✅ Done |
| 10 | Share a tab with a friend's account: view or edit (D19) | ✅ Done |

- `pnpm check` passes: typecheck, lint and **262 tests in 23 files**.
- `pnpm e2e` passes **42/42** on the production build, and
  `pnpm e2e:dev` passes **42/42** on the dev server.

## What the product is now

A multi-user web app for splitting shared expenses by activity (a trip,
a night out, a dinner). Each activity is a **tab**: you add the people
(plain names, no accounts needed), record who owes whom, and the app
nets each pair into "who pays whom", traceable to the rows behind it.

- **Users** register with email and password. They see their own tabs
  plus tabs friends shared with them.
- **Sharing (D19):** the owner shares a tab by a friend's email, as
  **Can view** or **Can edit**:
  - Editors change people, transactions, payments and splits.
  - Only the owner renames, archives or manages sharing.
  - The friend must already have an account.
- **Administrators** also see every user's tabs (read-only) and manage
  accounts: disable or enable, change role, set a new password. There
  is no email of any kind.
- **Sharing a result:** on Settlements there are four options:
  - Copy summary (text).
  - Share image (PNG).
  - Print or save PDF.
  - Download CSV.
- **Look:** enterprise style everywhere (D18). Navy app bar, slate
  neutrals, split-screen sign-in, admin tables. Indigo marks actions;
  green means money coming back or settled; red means errors.

## Where things live

| Area | Code |
|------|------|
| Settlement maths (pure) | `src/lib/settlement/`: engine, money, `splitAmount`, `personTotals`, ordering |
| Settlement view model | `src/lib/settlements/`: `buildSettlementSummary`, `summaryText`, `shareModel`, `settlementCsv`, `settlementService` |
| Exports | `src/app/(app)/tabs/[tabId]/settlements/{image,csv}/route.*`, `src/lib/settlements/exportRequest.ts` |
| Tabs, people, access checks | `src/lib/tabs/tabService.ts` (`loadReadableTab` / `loadWritableTab` / `loadOwnedTab`) |
| Sharing | `src/lib/tabs/shareService.ts`, `src/models/TabShare.ts`, `src/components/tabs/SharingPanel.tsx` |
| Transactions, splits, payments | `src/lib/transactions/`, `src/lib/payments/` |
| Accounts | `src/lib/users/userService.ts`, `src/lib/auth/` (sessions, throttle, `authedAction`, `Actor`) |
| Server Actions | `src/actions/` (every one wrapped in `authedAction`; a test enforces it) |
| Pages | `src/app/(app)/` (signed in), `src/app/login`, `src/app/register` |
| UI | `src/components/` (`ui/Sheet`, `ui/Money`, `shell/*`, `transactions/*`, `settlements/*`, `admin/*`) |
| Browser suite | `e2e/` (`serve.mjs` runs the app with a throwaway database) |
| Scripts | `scripts/create-admin.ts`, `scripts/backup.ts` (`pnpm backup` / `pnpm restore`) |

**Rules that bite**
- **Access:** every service takes an `Actor` and checks access itself. A
  tab the actor may not see is "not found", never "forbidden". Pick the
  right loader:
  - `loadReadableTab` for reads (owner, editor, viewer, admin);
  - `loadWritableTab` for changes inside a tab (owner, editor);
  - `loadOwnedTab` for the tab itself (owner only).

  Add a case to `tests/db/access.test.ts` for any new read or write.
- **Route handlers** don't run the `(app)` layout. They must check the
  session themselves (see `exportRequest.ts`). If they serve files, add
  their path to `EXPORT_PATH_PATTERN` so the proxy doesn't redirect them.
- **Mongoose:** `sanitizeFilter` is on globally, so your own operators
  inside a filter value (e.g. `$in`) need `mongoose.trusted(...)`, or
  they're silently neutralised. Aggregation pipelines are unaffected.
- **React:**
  - When alternative footers or confirm rows replace each other in the
    same slot, give each variant a `key`. Otherwise React reuses a
    `type="button"` as a `type="submit"` mid-click and the form submits.
  - Prefer uncontrolled inputs read at submit for forms people fill in
    first thing on a page. A controlled input resets text typed before
    hydration (WebKit showed this).
- **Forms:** don't disable a submit button based on client state that
  only exists after hydration (a phone that types before scripts load
  gets stuck). Validate on submit instead.
- **Streaming:** don't add a `loading.tsx` above `tabs/[tabId]/layout.tsx`.
  It starts streaming before the access check, and a 404 then goes out as
  200.
- **Next.js 16:** `middleware.ts` is `proxy.ts`. Error boundaries get
  `retry`, not `reset`. Read `node_modules/next/dist/docs/` first.

## How it was verified

- **Unit and integration** (`pnpm check`):
  - money and engine edge cases;
  - split rounding and per-person totals;
  - the share model and CSV, including quoting and formula injection;
  - schemas and services against an in-memory MongoDB;
  - sessions and throttling;
  - **authorization**, including the export data loader.
- **Browser** (`pnpm e2e`, `pnpm e2e:dev`): runs on the LAN IP in iPhone
  (WebKit), Pixel and desktop (Edge). Each run checks:
  - accounts;
  - the full acceptance flow by tapping;
  - exports and their access (200 for the owner and an admin; 404 for
    others, for signed-out requests and for malformed ids);
  - the print layout;
  - the section-nav scrollbar regression;
  - the read-only admin view;
  - sharing as view only, then edit, then leaving;
  - axe WCAG 2.2 AA on every main screen;
  - a hidden tab answering 404.

  Every test fails on console, CSP or page errors, and every screen gets
  the touch audit.
- **Looked at by eye:** the PNG renders ₱, → and long names correctly,
  and the print preview shows every card open with no app chrome.
- **Not verified:**
  - **A real phone.** In particular, the phone sheet with the on-screen
    keyboard open, which emulation can't show.
  - **The share sheet itself.** It needs HTTPS, and the suite runs over
    plain HTTP, where the button downloads instead.

## Loose ends

1. **Owner setup:** run `pnpm create-admin` with their email (`SETUP.md`
   step 5). Their `.env.local` still contains `ACTION_ALLOWED_ORIGINS=*`.
   That should be emptied, more so now that registration is open.
2. **Owner to confirm:**
   - Should the share image include line items or settled pairs? Today
     it shows neither (`buildShareModel`).
   - A payment in the reverse direction *adds* to the debt
     (`SETTLEMENT_RULES.md` → *Clarifications*). This has never been
     explicitly confirmed.
3. **Local data:** `.data/mongo` holds test tabs from early runs. Back it
   up (`pnpm backup`) or wipe it (`SETUP.md` → *Starting fresh*).
4. **Who changed what:** rows don't record who added or edited them.
   With editors that matters more. A `createdBy`/`updatedBy` on
   transactions, shown on hover or tap, would settle disputes. This is a
   good next step.
5. **Hydration race, mostly fixed:** typing before hydration is now kept
   on new tab and add person. Pressing *submit* before scripts load still
   does a plain page reload on forms without a Server Action `action`.
   That's rare, but progressive-enhancement forms would remove it.
6. **Nav highlight:** when an admin views someone else's tab, the top
   bar highlights "Tabs" rather than "Admin". The breadcrumb is correct.
7. **`pnpm audit`:** one high advisory, in `braces`, reached through
   `eslint-config-next`. It's a lint-time dev dependency only, with no
   patched version yet.
8. **Doc drift:** some docs haven't caught up with D15–D18:
   - `PHASING.md` → *Out of scope* still lists accounts and roles.
   - `UI_SPEC.md` and `REQUIREMENTS.md` still describe only the
     Apple-inspired look.
   - `README.md` still mentions Codex.
9. **Known limitations:**
   - Throttling trusts `x-forwarded-for` (spoofable without a trusted
     proxy); the global limit is the backstop.
   - Registration is open to anyone who can reach the app. With no
     email verification, someone could register a friend's email before
     the friend does. The owner sees the account's name when sharing.
   - No audit history of edits and deletes.
   - No notes or date columns, though both are stored.

## Possible next steps

- Try it on a real iPhone and Android phone on the LAN (TESTING.md →
  *Manual*), then behind HTTPS (e.g. a Cloudflare Tunnel or Tailscale),
  where Share image opens the share sheet in one tap.
- Add the e2e suite to CI if the repo gets one. It needs WebKit, and
  Chromium wherever Edge isn't installed.
- Add notes and date columns to the table (both are already stored).
- Add an invite code for registration if the app is ever reachable
  beyond people you trust.

## Running it

See **`SETUP.md`**. In short:

```sh
pnpm install
pnpm db:local        # terminal 1, leave running
pnpm create-admin    # once
pnpm dev             # terminal 2: http://localhost:3000 or http://<LAN-IP>:3000
pnpm check           # typecheck + lint + tests
pnpm e2e             # browser suite (own server on :3217, own database)
pnpm backup          # dated backup in .data/backups
```
