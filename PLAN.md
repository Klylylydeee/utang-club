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
