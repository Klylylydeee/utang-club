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

## Milestone 7 --- Hardening

-   Integration tests.
-   Empty/loading/error states.
-   Responsive layout.
-   Accessibility pass.
-   README setup instructions.

## Decision log

Add architectural or financial-rule decisions here when they are made.

-   2026-10-03 --- Detailed phasing, working decisions D1--D14 and
    per-phase exit criteria are maintained in `PHASING.md`.
-   2026-10-03 --- Milestones 1 and 2 complete (see `PHASING.md` decision log).
