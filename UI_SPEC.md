# UI Specification

## Utang Club visual language

Utang Club should use an **Apple-inspired design philosophy**: simple,
highly legible, spacious, tactile, and focused on the user's current
task. This is a design-principle reference, not a request to clone Apple
applications.

### Visual principles

-   Use generous whitespace and strong alignment.
-   Use a clean system-font stack with clear type hierarchy.
-   Prefer off-white/white surfaces in light mode and carefully layered
    dark neutrals in dark mode.
-   Use subtle separators instead of heavy table borders wherever
    possible.
-   Use rounded cards and controls with restrained radii.
-   Shadows should be soft and used only to communicate elevation.
-   Use translucency/backdrop blur sparingly for floating navigation or
    overlays.
-   Use one restrained accent color for primary actions and selection
    states.
-   Monetary totals should be visually prominent without becoming
    oversized.
-   Animations should be short and functional; respect
    `prefers-reduced-motion`.

### Interaction principles

-   Prioritize direct manipulation and immediate feedback.
-   Make the transaction-entry experience fast despite the minimalist
    appearance.
-   Keep destructive actions secondary and require confirmation when
    data loss is possible.
-   Use progressive disclosure for advanced fields such as foreign
    currency and notes.
-   Settlement cards should be scannable at a glance, with details
    available on expansion.
-   Design mobile layouts as first-class experiences rather than
    compressed desktop screens.

### Brand tone

Use **Utang Club** prominently in the application shell. The product
should feel approachable for friends sharing expenses while still being
trustworthy enough for money tracking.

## Design goal

Make data entry feel close to a spreadsheet while making the settlement
result easier to understand than the original spreadsheet.

## Tab screen (one tab of expenses)

Header: - Tab name - Participant count - Total transaction count -
Section switcher (segmented control): Transactions \| Settlements

The word "tab" always means a tab of expenses. Never use "tab" for UI
navigation; call that a section or view.

## Transactions view

Primary element: editable table.

Columns: 1. Description 2. Foreign Currency 3. Foreign Amount 4. Amount
in PHP 5. To Pay 6. To Be Paid 7. Type 8. Actions

Behavior: - Add-row button remains easy to reach. - Participant fields
use dropdown/combobox. - Currency inputs are right-aligned. - Keyboard
navigation should be supported where practical. - Save state/error state
should be visible.

##Section switcher (segmented control): Transactions | Settlements view

Render a responsive grid of settlement cards similar in concept to the
user's second spreadsheet.

Card header: `Adrian → Klyde`

Card body: - contributing expense/payment descriptions - amount for each
line - visual distinction for offsets/payments - final outstanding
amount highlighted

Card footer: - `Outstanding: ₱X,XXX.XX` - `Record Payment`

If reciprocal obligations reverse the direction, the card header must
show the final net direction.

## Zero balance

A fully settled pair should show `Settled` in history, but can be hidden
from the default Outstanding view.

## Mobile

On narrow screens, the transaction table may become horizontally
scrollable. Settlement cards stack vertically.

## Mobile and external-device access

**Requirement:** every interactive element (links, buttons, inputs,
dropdowns, row actions, card expand, dialogs, login) must work on a
phone or another device on the network. This applies to the dev server
(`pnpm dev`) and the production build (`pnpm build && pnpm start`), and
over plain-HTTP LAN addresses (`http://192.168.x.x:3000`) as well as
HTTPS.

### Why it breaks if ignored

When a page loads from an external device, the server still renders the
HTML, so it looks fine. But if the JavaScript is blocked or fails,
React never "hydrates" the page and **nothing responds to taps**. The
known causes in this stack, and what we do about each:

| Cause | Mitigation |
|-------|------------|
| Next.js dev blocks dev assets requested from origins other than localhost | `allowedDevOrigins` in `next.config.ts` lists this machine's LAN IPs automatically (via `os.networkInterfaces()`) plus any extra hosts in `DEV_ALLOWED_ORIGINS`. |
| Server only listening on localhost | The `dev` and `start` scripts bind to `0.0.0.0` (`-H 0.0.0.0`). |
| The CSP blocks dev scripts or the hot-reload websocket | The dev CSP adds `'unsafe-eval'` and `ws:`/`wss:` to `connect-src`. The production CSP stays strict. |
| `upgrade-insecure-requests` or HSTS sent over plain HTTP | Both are sent only when the request actually came over HTTPS, never just because it's a production build. |
| A `Secure` / `__Host-` session cookie is silently dropped over `http://` LAN, so login appears to "do nothing" | The cookie's `Secure` flag and `__Host-` prefix depend on the protocol of the actual request (taking `x-forwarded-proto` into account), not on `NODE_ENV`. When served over HTTP, the login page shows a "not a secure connection" notice. |
| The Server Action origin check rejects requests from tunnels or proxies | `serverActions.allowedOrigins` is read from the env setting `ACTION_ALLOWED_ORIGINS`, which is empty by default. A direct LAN IP needs nothing, because Origin and Host already match. |

### Touch interaction rules

-   Tap targets are at least 44 × 44 px, with at least 8 px between
    neighbouring targets.
-   Nothing depends on hover. Row actions and card controls are always
    visible or sit behind an explicit "⋯" button; they never appear
    only on hover.
-   Interactive elements are native `<button>`, `<a>`, `<input>` or
    `<select>`. No clickable `<div>`s.
-   No invisible layer may block taps. Decorative, blurred and
    gradient layers use `pointer-events: none`. Closed dialogs, sheets
    and menus are unmounted or `inert`. Sticky headers never cover
    controls.
-   Inputs use at least a 16 px font size, so iOS doesn't zoom in on
    focus. Amount fields use `inputmode="decimal"`.
-   The viewport meta tag is `width=device-width, initial-scale=1` and
    never disables zoom. Sticky bars respect `env(safe-area-inset-*)`.
-   Controls use `touch-action: manipulation` to remove the tap delay.
    Horizontal table scrolling must not swallow taps on cells.
-   On narrow screens, a transaction row may open in a bottom sheet for
    editing, instead of being edited inside the scrolling table.
-   Dialogs stay usable while the on-screen keyboard is open (the
    content scrolls and the primary action stays reachable).

## Accessibility

-   Form controls require labels.
-   Do not communicate payment status by color alone.
-   Buttons and table actions must be keyboard accessible.
