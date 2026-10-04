# Settlement Rules

## Canonical interpretation

For each transaction: - `payer` / `toPay` = debtor - `recipient` /
`toBePaid` = creditor - `amountPhp` = amount the debtor owes the
creditor

A row is directional.

## Pairwise netting

For any two people A and B:

`net(A,B) = sum(A owes B) - sum(B owes A)`

If: - net \> 0: A owes B `net` - net \< 0: B owes A `abs(net)` - net =
0: no outstanding settlement

Only one final outstanding direction should be shown for a pair.

## Example

Transactions: - Adrian -\> Klyde: ₱123.03 - Adrian -\> Klyde:
₱1,301.00 - Klyde -\> Adrian: ₱100.00

Result: - Adrian -\> Klyde: ₱1,324.03

## Payment transactions

A payment is preserved as its own transaction.

If Adrian currently owes Klyde ₱3,885.10 and Adrian pays Klyde
₱3,885.10, record a payment that offsets the obligation. The
implementation may model this as a typed payment with explicit
settlement semantics, but the calculation must have the same effect as a
reverse credit against Adrian's outstanding debt.

Preferred model: - `type: "payment"` - `payer`: Adrian - `recipient`:
Klyde - `amountPhpCentavos`: 388510

Calculation: - expenses increase `payer -> recipient` obligation -
payments decrease `payer -> recipient` obligation

Do not confuse a payment with a new expense.

## Money representation

Use integer centavos for calculation.

Examples: - ₱0.01 = 1 - ₱123.03 = 12,303 - ₱12,039.75 = 1,203,975

No floating-point summation.

## Ordering

For deterministic output: 1. Sort settlement cards by debtor display
name, then creditor display name. 2. Within a settlement, sort
contributing transactions by transaction date, then creation time.

## Negative amounts

Normal expense input must not use negative amounts. Direction is
represented by payer/recipient.

Imported legacy data containing negative values must be normalized
during import, not carried into the core calculation.

## Self-transactions

A transaction where payer == recipient is invalid.

## Global simplification

Do not transform: - A owes B - B owes C

into: - A owes C

for the MVP. Pairwise netting is intentionally auditable and mirrors the
spreadsheet behavior.

## Splitting a bill

Added 2026-10-04 at the owner's request. A split is a shortcut for
entering several ordinary expense rows at once; it adds no new rule to
settlement itself.

-   Inputs: a total, the person who paid, and the participants (the
    payer is included by default).
-   Each participant's share is `floor(total / participants)` centavos.
-   The leftover `total − share × participants` centavos are given one
    each to the **debtors** (participants other than the payer), in
    display-name order. The payer recovers everything they're owed.
-   One expense row is created per debtor (debtor → payer, for their
    share). The payer's own share creates no row.
-   A split where any debtor's share would be ₱0.00 is rejected.

Example: Klyde pays ₱100.00 for Adrian, Klyde and Simon. Share =
₱33.33, leftover = 1 centavo. Adrian owes Klyde ₱33.34 and Simon owes
Klyde ₱33.33.

## Clarifications

These were added on 2026-10-03, when the engine was implemented. They
make existing behaviour explicit and do not change any rule above.

-   **Payment in the reverse direction.** A payment from B to A while A
    owes B *increases* A's debt. Example: B hands A cash, so A now owes
    B that amount too. This follows from "payments decrease
    payer → recipient".
-   **Overpayment.** A payment larger than the outstanding balance
    reverses the direction (decision D1 in `PHASING.md`).
-   **Undated rows.** When ordering line items, a row without a
    `transactionDate` uses its `createdAt` in its place.
-   **Settled pairs.** These are still returned, with all their line
    items, so they can be shown as "Settled". Because they have no real
    direction, they are displayed alphabetically by name.
-   **Invalid rows.** The engine rejects them (by throwing) and never
    skips them silently. Validation at the write boundary must stop
    them first.
