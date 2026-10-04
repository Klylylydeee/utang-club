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
service checks access to the tab itself. Owners read and write their
tabs; admins read any tab but write only their own; anyone else gets
"not found". `tests/db/access.test.ts` covers this for every service.

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

-   Validation errors: inline, field-specific.
-   Database/network errors: clear non-destructive message.
-   Never silently discard unsaved transaction edits.

## Performance

MVP data volumes are expected to be small. Prefer correctness and
traceability over premature caching.
