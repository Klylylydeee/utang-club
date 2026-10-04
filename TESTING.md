# Testing Requirements

## Unit tests --- settlement engine

At minimum test:

### Single obligation

Adrian -\> Klyde ₱123.03 Expected: Adrian -\> Klyde ₱123.03

### Same-direction aggregation

Adrian -\> Klyde ₱123.03 Adrian -\> Klyde ₱1,301.00 Expected: Adrian -\>
Klyde ₱1,424.03

### Reciprocal partial offset

Adrian -\> Klyde ₱123.03 Klyde -\> Adrian ₱100.00 Expected: Adrian -\>
Klyde ₱23.03

### Reciprocal reversal

Adrian -\> Klyde ₱100.00 Klyde -\> Adrian ₱150.00 Expected: Klyde -\>
Adrian ₱50.00

### Exact cancellation

Adrian -\> Klyde ₱100.00 Klyde -\> Adrian ₱100.00 Expected: no
outstanding settlement

### Multiple independent pairs

Ensure Adrian/Klyde calculations do not modify Simon/Via calculations.

### Payment

Expense: Adrian owes Klyde ₱3,885.10 Payment: Adrian pays Klyde
₱3,885.10 Expected: zero outstanding balance; both source records
remain.

### Centavo precision

Use values such as ₱0.01, ₱0.02, and ₱123.03. No floating-point drift is
permitted.

## Validation tests

-   amount \<= 0 rejected for normal manual expense
-   payer == recipient rejected
-   missing payer rejected
-   missing recipient rejected
-   missing description rejected
-   malformed currency amount rejected

## Integration tests

-   Create tab -\> add people -\> add expense -\> settlement updates.
-   Edit transaction -\> settlement recalculates.
-   Delete transaction -\> settlement recalculates.
-   Record payment -\> outstanding amount decreases.

## Manual acceptance flow

1.  Create a tab.
2.  Add Adrian and Klyde.
3.  Add Adrian -\> Klyde ₱123.03.
4.  Confirm settlement ₱123.03.
5.  Add Klyde -\> Adrian ₱100.00.
6.  Confirm settlement changes to ₱23.03.
7.  Record ₱23.03 payment.
8.  Confirm pair is settled while transaction history remains visible.

## External-device and touch tests

See `UI_SPEC.md` → *Mobile and external-device access*.

### Automated (Playwright)

-   Run under both `pnpm dev` and `pnpm build && pnpm start`.
-   Point `baseURL` at the machine's **LAN IP**, not `localhost`. This
    catches `allowedDevOrigins`, CSP and cookie problems.
-   Device profiles: an iPhone (WebKit) and a Pixel (Chromium), with
    touch enabled.
-   On each screen (login, tab list, new tab, transactions,
    settlements, payment dialog):
    -   The page hydrates, and the console shows no CSP violations or
        blocked requests.
    -   Every visible link, button and input passes a "tappable" check:
        `document.elementFromPoint()` at the centre of the element
        returns that element or one of its children (this catches
        overlays), and its box is at least 44 × 44 px.
    -   The core flow works entirely by tapping: log in, then do the
        manual acceptance flow.
-   Over HTTP, logging in sets a session cookie and the user stays
    logged in after a reload.

### Manual (real devices, same Wi-Fi)

For both the dev build and the production build, on iOS Safari and
Android Chrome, at `http://<LAN-IP>:3000`:

1.  Log in.
2.  Complete the manual acceptance flow by touch only.
3.  Open every dialog, dropdown and row action. Expand every card.
4.  Rotate the device, then repeat a tap-through.
5.  Type in an amount field: the page doesn't zoom, and the save button
    stays reachable while the keyboard is open.
