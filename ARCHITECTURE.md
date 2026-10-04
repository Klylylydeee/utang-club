# Architecture

## Application

Use a single Next.js application.

### UI

-   Next.js App Router
-   React
-   Tailwind CSS
-   Server Components for initial data rendering
-   Client Components for editable tables, dialogs, and optimistic
    interactions

### Server

Use Server Actions or Route Handlers for mutations. Keep database access
server-only.

Suggested layers: 1. UI components 2. Server action / route handler 3.
Zod validation 4. Domain/service function 5. Mongoose model 6. MongoDB

Mutations are Server Actions in `src/actions/`, one file per area
(`tabs.ts`, `people.ts`, `transactions.ts`, `session.ts`). Each action is
a thin wrapper: `authedAction(schema, handler)` → a service in
`src/lib/<area>/` → Mongoose. Actions return `ActionResult`
(`src/lib/actions/result.ts`); services throw `DomainError` for expected
failures (not found, conflict, read-only, in use), which the wrapper maps
to a result. Anything else is logged on the server and reported
generically.

### Exports (route handlers)

Exports are the only route handlers, since a file download can't come
from a Server Action. They sit next to the Settlements page:

-   `tabs/[tabId]/settlements/image` returns a PNG built with
    `ImageResponse` (`next/og`) and Geist from `src/assets/fonts`.
-   `tabs/[tabId]/settlements/csv` returns the CSV.

Route handlers don't run the `(app)` layout. Each one calls
`loadExportForRequest` (`src/lib/settlements/exportRequest.ts`), which
checks the session and then calls `getSettlementExport`, so access is
enforced as usual. A malformed id, no session, or a tab you may not see
all answer 404, with `Cache-Control: private, no-store`. The proxy
doesn't redirect these paths to sign-in (`EXPORT_PATH_PATTERN`), so a
script fetching the image gets the 404 instead of an HTML page. The
formatting is pure and unit-tested: `buildShareModel` and
`buildSettlementCsv`. Print / Save as PDF is only a print stylesheet
(`globals.css`) plus `PrintButton`.

### Accounts and access

Users register at `/register` and sign in at `/login` with email and
password (PHASING.md D15–D17). Everything else requires a session. The
check happens in two layers:

1.  `src/proxy.ts` (Next.js 16's name for middleware) redirects GET
    requests with no session cookie to `/login?next=…`, and sets the
    per-request CSP nonce and the transport-dependent headers. It skips
    prefetch requests; that's safe because layer 2 re-checks. **It is
    not the security boundary.**
2.  The real check looks the session up in MongoDB:
    -   `requireSession()` in `src/app/(app)/layout.tsx` guards every
        page in the `(app)` route group. `/login` and `/register` live
        outside the group. `requireAdmin()` guards `/admin` (others get
        a 404).
    -   `authedAction()` guards every Server Action. An expired session
        returns `{ code: "unauthenticated" }` instead of redirecting, so
        the client keeps unsaved edits.

Authorization is a third layer, inside the services: `authedAction`
passes an `Actor` (user id and role) to every service, and every
service checks access to the tab itself, through three loaders in
`src/lib/tabs/tabService.ts`:

| Loader | Who passes | Used for |
|--------|-----------|----------|
| `loadReadableTab` | owner, editor, viewer, admin | every read, exports |
| `loadWritableTab` | owner, editor; active tabs only | people, transactions, payments, splits |
| `loadOwnedTab` | owner | rename, archive, sharing |

Editors and viewers come from `TabShare` (D19): the owner shares a tab
with an existing account by email. A share outranks the admin role, so
an admin a tab is shared with as an editor can edit that tab. Anyone else
gets "not found". `tests/db/access.test.ts` covers this for every
service and every access level.

Sessions, the throttle and the CSP live in `src/lib/auth/` and
`src/lib/security/`; accounts in `src/lib/users/`.

### Settlement engine

`src/lib/settlement/` is framework-independent.

Suggested API:

``` ts
type SettlementInput = {
  id: string;
  type: "expense" | "payment";
  payerId: string;
  recipientId: string;
  amountPhpCentavos: number;
};

type PairwiseSettlement = {
  debtorId: string;
  creditorId: string;
  amountPhpCentavos: number;
  transactionIds: string[];
};

function calculatePairwiseSettlements(
  transactions: SettlementInput[]
): PairwiseSettlement[];
```

The function must be deterministic and pure.

## Suggested routes

``` text
/                       tab list/dashboard
/tabs/new              create tab
/tabs/[tabId]         overview
/tabs/[tabId]/transactions
/tabs/[tabId]/settlements
```

## Suggested APIs/actions

-   createTab
-   updateTab
-   addPerson
-   updatePerson
-   createTransaction
-   updateTransaction
-   deleteTransaction
-   recordPayment
-   getSettlements

## State strategy

Database state is authoritative. Client-side optimistic state is allowed
for responsive editing, but failed writes must roll back visibly.

## Error handling

-   Unexpected errors: `(app)/error.tsx` (the app bar stays) and
    `global-error.tsx`. A tab you may not see renders `(app)/not-found.tsx`
    with HTTP 404.
-   Loading skeletons live only in `tabs/[tabId]/loading.tsx`. A
    `loading.tsx` higher up would start streaming before the tab's
    access check, and a 404 would then go out as 200.
-   Validation errors: inline, field-specific.
-   Database/network errors: clear non-destructive message.
-   Never silently discard unsaved transaction edits.

## Performance

MVP data volumes are expected to be small. Prefer correctness and
traceability over premature caching.
