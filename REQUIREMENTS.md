# Product Requirements --- Personal Utang Club

## Product identity

**Name:** Utang Club

Utang Club is a personal shared-expense and settlement application. Its
interface should follow Apple-inspired principles: minimal, spacious,
highly legible, responsive, and polished, while retaining fast
spreadsheet-like transaction entry.

## Goal

Replace a manually maintained spreadsheet with a web app that accepts
transaction rows and automatically generates settlement summaries
showing who needs to pay whom and why.

## Primary user

A person tracking shared meals, purchases, bills, travel, and cash
advances among friends or colleagues. Usually month by month, but
whenever it makes sense to start fresh.

## Tabs

A **tab** is the container for one stretch of shared expenses, the way
you'd run a tab at a bar and settle it at the end. Most tabs cover a
month ("October 2026"), but a tab can cover any period the user
chooses: a trip, a payday cycle, or "until we're even". A tab has its
own participants and transactions, and is settled on its own. New tabs
default to the current month's name, which the user can change.

## MVP workflow

The user opens a tab, adds participants, and enters
rows containing: - Description - Foreign currency (optional) - Foreign
amount (optional) - PHP amount - To Pay (debtor) - To Be Paid (creditor)

The app immediately derives settlement summaries.

## Example input

  Description               Foreign       PHP To Pay   To Be Paid
  ----------------------- --------- --------- -------- ------------
  Mineral Water              \$2.46   ₱123.03 Adrian   Klyde
  Water during Checkout      \$2.00   ₱100.00 Klyde    Adrian

These two rows net to: **Adrian owes Klyde ₱23.03**

## Required features

### Tabs

-   Create, rename, archive, and open a tab.
-   Archived tabs are read-only (decision D6) and can be unarchived.
-   Each tab has its own participants and transactions.

### Participants

-   Add participant.
-   Edit display name.
-   Prevent accidental duplicate names within a tab, using
    case-insensitive validation.

### Transaction table

-   Spreadsheet-like entry.
-   Add, edit, duplicate, and delete rows.
-   Columns: Description, Foreign Currency, Foreign Amount, Amount in
    PHP, To Pay, To Be Paid.
-   Foreign fields are optional.
-   PHP amount is required and must be greater than zero for normal
    expense rows.
-   Payer and recipient are required and cannot be the same person.
-   Support a transaction type of `expense` or `payment`.

### Settlement summary

-   Generate one card/section per net debtor -\> creditor relationship.
-   Show final balance prominently.
-   Show all contributing line items.
-   Reciprocal transactions must reduce the balance.
-   Zeroed relationships may be hidden by default but remain available
    in history.
-   Recalculate whenever a transaction changes.

### Payment recording

From a settlement card, allow the user to record a payment. Example: if
Adrian owes Klyde ₱3,885.10, recording that payment creates a traceable
payment transaction and the remaining balance becomes ₱0.00.

### Formatting

-   PHP display format: `₱12,345.67`.
-   Foreign currency should retain its original currency code/symbol and
    amount.
-   Do not derive PHP from foreign amount unless an exchange-rate
    feature is explicitly added.

## Out of scope for MVP

-   Bank/payment gateway integration
-   OCR from receipts/screenshots
-   Live FX rates
-   Tax accounting
-   Global debt optimization across three or more participants
-   Public social features
-   Native mobile application

## Acceptance criteria

1.  Entering a row where Adrian owes Klyde ₱123.03 produces an Adrian
    -\> Klyde obligation of ₱123.03.
2.  Adding Klyde -\> Adrian ₱100.00 changes the net settlement to Adrian
    -\> Klyde ₱23.03.
3.  Equal reciprocal amounts produce no outstanding pairwise balance.
4.  Editing/deleting a source row immediately changes the derived
    summary.
5.  Recording a full payment reduces the settlement to zero without
    deleting the original expenses.
6.  Every settlement can be traced back to its contributing
    transactions.
7.  Money calculations remain exact to centavos.
