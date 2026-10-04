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
