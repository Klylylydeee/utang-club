# Implementation Plan

Keep this file updated while implementing substantial features.

## Milestone 1 --- Bootstrap

-   Create Next.js TypeScript project.
-   Configure Tailwind.
-   Configure MongoDB/Mongoose.
-   Add environment validation.
-   Establish models and Zod schemas.

Done when the app starts locally and can connect to the configured
database.

## Milestone 2 --- Domain engine

-   Implement integer-centavo money helpers.
-   Implement pairwise settlement calculation.
-   Add complete unit tests from `TESTING.md`.

Done when settlement tests pass independently of the UI/database.

## Milestone 3 --- Tabs and participants

-   Tab CRUD for MVP.
-   Participant add/edit.
-   Duplicate-name validation.

## Milestone 4 --- Transaction entry

-   Spreadsheet-like transaction table.
-   Create/edit/delete transaction.
-   Validation and formatting.
-   Optional foreign currency fields.

## Milestone 5 --- Settlement summary

-   Calculate pairwise settlements.
-   Settlement cards.
-   Expandable contributing line items.
-   Outstanding vs settled views.

## Milestone 6 --- Payments

-   Record payment from settlement card.
-   Preserve audit trail.
-   Recalculate balance.

## Milestone 6b --- Owner requests (2026-10-04)

Requested after Phase 6. Assumptions and affected areas:

-   **Record payment** (= Milestone 6): `recordPayment` action
    (`src/actions/payments.ts`) and a dialog on outstanding settlement
    cards, prefilled with the outstanding amount (D7). Overpaying needs a
    second "Save anyway" confirmation (D1); the server compares integers.
-   **Split a bill**: one total, one payer, ticked participants (payer
    ticked by default). Creates one expense row per other participant,
    each owing the payer. Rounding rule decided by the owner and
    recorded in `SETTLEMENT_RULES.md` → *Splitting a bill*. Pure
    `splitAmount` in `src/lib/settlement/`.
-   **Copy summary**: a plain-text summary of outstanding pairs and
    per-person totals, to paste into chats. The clipboard API needs
    HTTPS, so plain-HTTP LAN falls back to a selectable text box. No
    share links (that would widen the auth scope).
-   **Phone entry**: below the `md` breakpoint the table is replaced by
    a row list; tapping a row (or "Add") opens a bottom-sheet editor.
-   **Per-person totals**: for each person, the total they owe, the
    total owed to them, and the net, derived from the pairwise
    settlements. No global simplification; the pairs stay the source.

## Milestone 6c --- Export a summary (2026-10-04) --- done

Recommended in `HANDOFF.md`; the owner said to proceed. Assumptions:

-   **The image leaves out line items and settled pairs**, which is the
    HANDOFF default. The owner never answered on these, so this needs
    confirming; both are one-line changes in `buildShareModel`.
-   Exports are read-only views, so both the owner and an admin can use
    them. They go through `getSettlements`, which already checks access.

Steps:

1.  **Share image (PNG).** A pure `buildShareModel` in
    `src/lib/settlements/shareModel.ts` caps the pairs at 20 and adds
    "and N more". `getShareImageData(tabId, actor)` lives in the service.
    The route is `src/app/(app)/tabs/[tabId]/settlements/image/route.tsx`
    using `ImageResponse`. It checks the session itself and returns 404
    for anything the user can't see. Fonts are under `src/assets/fonts/`.
    The `ShareImageButton` opens the share menu where the Web Share API
    exists and downloads the file otherwise.
2.  **Print / Save as PDF.** `@media print` styles, plus a
    `PrintButton` that opens every `<details>` on `beforeprint` and
    restores them on `afterprint`.
3.  **CSV.** A pure `buildSettlementCsv` with RFC 4180 quoting and a
    guard against spreadsheet formula injection. The route is
    `settlements/csv/route.ts`, with the same access rule as the image.

Tests: unit tests for `buildShareModel` and `buildSettlementCsv`, and
cases in `tests/db/access.test.ts` for the export data loaders.

## Milestone 10 --- Share a tab with view or edit access (2026-10-04, D19) --- done

The owner asked: "a user should add their friend's email; then they can
either view or edit it, based on the capability the user approved". This
overrides the "no shared tabs" line in `AGENTS.md`.

Decisions (defaults, open to change):

-   **Each share has a capability, `viewer` or `editor`.** The owner
    chooses it when sharing and can change or revoke it at any time.
-   **Viewers** see everything in the tab: people, transactions,
    settlements, and every export. They change nothing.
-   **Editors** can also change everything *inside* the tab: people,
    transactions, payments and splits. They go through the same
    `loadWritableTab` check as the owner, so archived tabs are
    read-only for them too.
-   **Only the owner** renames or archives the tab and manages sharing.
    That uses `loadOwnedTab`, which stays owner-only. Neither
    capability can share the tab further or see who else has access.
-   **Existing accounts only.** There's no email verification, so a
    pending invite to an email without an account could be claimed by
    whoever registers that email first. The owner sees the account's
    name after sharing, so they can spot a wrong one. The share form
    reveals whether an email has an account, but registration already
    reveals that.
-   **Anyone shared with can leave** ("Remove from my tabs").
-   **Admins** keep read-only access to every tab, but can't manage
    sharing on other people's tabs. If a tab is shared with an admin as
    an editor, the share applies: they can edit that tab.
-   At most 50 shares per tab. Access is checked on every request, so a
    change or removal takes effect immediately.

Affected files:

-   **Model and schema:** `src/models/TabShare.ts` (`tabId`, `userId`,
    `role`, unique per pair) and `src/schemas/share.ts`.
-   **Services:**
    -   `src/lib/tabs/tabService.ts`: `accessTo` gets `"editor"` and
        `"viewer"`, `loadWritableTab` accepts editors, and a
        `listSharedTabs` lists tabs shared with the actor.
    -   `src/lib/tabs/shareService.ts`: list, add, change capability,
        remove and leave.
-   **Actions:** `src/actions/shares.ts`.
-   **UI:**
    -   Overview: a Sharing panel for the owner.
    -   Tab layout: a banner for people the tab is shared with, with a
        Leave button.
    -   The tab-details card and the archive toggle are shown to the owner
        only.
    -   Home page: a "Shared with you" list.
-   **Backups:** `tabshares` added to `scripts/backup.ts`.
-   **Tests:** `tests/db/access.test.ts` (viewer, editor, revoke, sharing
    rules), `tests/db/shares.test.ts`, and an e2e flow.
-   **Docs:** `DATA_MODEL.md`, `ARCHITECTURE.md`, `AGENTS.md`,
    `PHASING.md` (D19), `README.md`, `HANDOFF.md`.

## Milestone 11 --- Who added and changed each transaction (2026-10-04) --- done

Recommended after sharing (D19): once friends can edit a tab, a disputed
amount needs to show who entered or changed it. The owner said to
proceed.

Decisions:

-   **Storage:** `Transaction` gets `createdBy` and `updatedBy` (User
    ObjectIds) and keeps its `updatedAt` timestamp. Rows from before
    this change have neither, and show nothing.
-   **What sets them:**
    -   Every row created (manual entry, duplicate, payment, split) sets
        `createdBy`.
    -   An edit sets `updatedBy` only when a field actually changes, so
        saving an untouched row doesn't mark it "edited".
-   **What the screen gets:** names only, plus `isYou` (never user ids
    or emails): "Added by you", "Added by Bea, edited by Dave".
-   **Where it shows:**
    -   A line under each transaction: desktop table, phone list, phone
        sheet, read-only table.
    -   Settlement card line items.
    -   CSV columns "Added by" and "Edited by".
    -   Not on the share image.
-   **When it shows:** only on tabs where more than one account is
    involved: the tab is shared, the viewer isn't its owner, or another
    account wrote a row. A tab only you use stays as clean as before.
    The CSV always includes the columns.
-   **Out of scope:** deletes aren't recorded. Rows are still
    hard-deleted, and soft delete is a separate recommendation.

Affected files:

-   `src/models/Transaction.ts`.
-   `src/lib/transactions/{transactionService,splitService,types,authorship}.ts`.
-   `src/lib/tabs/{tabService,types}.ts`: `isShared`.
-   `src/lib/settlements/{buildSettlementSummary,types,settlementCsv}.ts`.
-   Transaction and settlement components, and the transactions and
    settlements pages.
-   **Tests:** authorship rules (unit), services (`createdBy`/`updatedBy`,
    no-op edits), CSV, and an e2e check on a shared tab.
-   **Docs:** `DATA_MODEL.md`, `PHASING.md` log, `HANDOFF.md`, `README.md`.

## Milestone 12 --- Deleted transactions are kept and can be restored (2026-10-04) --- done

This closes the gap left by milestone 11. Before it, a deleted row was
simply gone, with no trace of who removed it, which went against
"never destroy the audit trail".

Decisions:

-   **Soft delete:** deleting sets `deletedAt` and `deletedBy` instead of
    removing the document. Deleted rows leave every total, count,
    settlement, payment check and export. They stay in the database,
    with no purge for now.
-   **Undo:** right after a delete, the table and the phone list show
    "Deleted “Ramen”. Undo".
-   **"Recently deleted":** a collapsed section under the transactions
    lists every deleted row with who deleted it and when. Owners and
    editors can restore a row. Viewers and admins see the list
    read-only, because it's part of the history.
-   **Restore** brings a row back as it was, with its author and editor
    unchanged. Restoring doesn't count as an edit. The tab must be
    active and writable, as for any change.
-   **People:** someone who appears only in deleted rows still can't be
    removed from the tab, so a restore never points at a missing
    person. The message says why.

Affected files:

-   `src/models/Transaction.ts`.
-   `src/lib/transactions/{transactionService,types}.ts`.
-   `src/lib/tabs/tabService.ts`: counts and the person-in-use check.
-   `src/schemas/transaction.ts`, `src/actions/transactions.ts`.
-   **Components:** the transaction table, the phone list, a new
    `UndoDeleteNotice`, and a new `DeletedTransactions` section.
-   **Tests:** access (restore and the deleted list), the service
    (totals ignore deleted rows; restore; person in use), and e2e
    (undo, then restore from the list).
-   **Docs:** `DATA_MODEL.md`, `PHASING.md`, `HANDOFF.md`, `README.md`.

## Milestone 7 --- Hardening (PHASING Phase 8) --- done

-   Integration tests.
-   Empty/loading/error states.
-   Responsive layout.
-   Accessibility pass.
-   README setup instructions.
-   A committed Playwright suite (`e2e/`, `@playwright/test`) built from
    the throwaway session scripts. It runs on the LAN IP in Chromium
    and WebKit with the touch audit, against a throwaway database.
-   A `pnpm backup` script that writes a dated `mongodump`-style export.

## Decision log

Add architectural or financial-rule decisions here when they are made.

-   2026-10-03 --- Detailed phasing, working decisions D1--D14 and
    per-phase exit criteria are maintained in `PHASING.md`.
-   2026-10-03 --- Milestones 1 and 2 complete (see `PHASING.md` decision log).
-   2026-10-04 --- Milestones 3--7, 6b and 6c complete. Notes for each
    are in the `PHASING.md` decision log.
