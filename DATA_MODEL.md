# MongoDB Data Model

## User

Added 2026-10-04 (PHASING.md D15).

``` ts
interface User {
  _id: ObjectId;
  email: string;          // lowercased, trimmed; unique
  name: string;
  passwordHash: string;   // scrypt:N:r:p:salt:hash; never sent to the browser
  role: "user" | "admin";
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
}
```

Index: `{ email: 1 }` unique.

## Tab

``` ts
interface Tab {
  _id: ObjectId;
  ownerId: ObjectId;     // User; only the owner can change the tab
  name: string;
  description?: string;
  baseCurrency: "PHP";
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}
```

## Person

``` ts
interface Person {
  _id: ObjectId;
  tabId: ObjectId;
  displayName: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Recommended unique index: `{ tabId: 1, normalizedName: 1 }`

## Transaction

``` ts
type TransactionType = "expense" | "payment";

interface Transaction {
  _id: ObjectId;
  tabId: ObjectId;
  type: TransactionType;

  description: string;

  foreignCurrency?: string;
  foreignAmountMinor?: number;

  amountPhpCentavos: number;

  payerId: ObjectId;
  recipientId: ObjectId;

  transactionDate?: Date;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

## Session

Server-side login session (PHASING.md D12). The cookie holds only a
random token; the database stores its SHA-256.

``` ts
interface Session {
  _id: ObjectId;
  userId: ObjectId;            // User
  tokenHash: string;           // SHA-256 of the cookie token (unique)
  passwordFingerprint: string; // must match the user's current passwordHash
  lastSeenAt: Date;
  expiresAt: Date;             // sliding 7-day idle expiry (TTL index)
  absoluteExpiresAt: Date;     // hard 30-day cap
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ tokenHash: 1 }` unique, `{ expiresAt: 1 }` TTL, `{ userId: 1 }`.

## LoginThrottle

Failed-login counters: one document per hashed client IP, plus one
`"global"` document.

``` ts
interface LoginThrottle {
  _id: ObjectId;
  key: string;            // HMAC (AUTH_SECRET) of a client IP, a sign-in email, a
                          // registering client IP, or "global"
  windowStartedAt: Date;
  failures: number;
  lockedUntil: Date | null;
  lockCount: number;      // drives the backoff
  expiresAt: Date;        // TTL: forgotten after a quiet day
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ key: 1 }` unique, `{ expiresAt: 1 }` TTL.

## Why settlements are not the source of truth

Settlement summaries are derived data. The transaction collection is
canonical.

For the MVP, calculate settlements from transactions on demand or cache
them only as a performance optimization. If caching is introduced, it
must be safely rebuildable.

## Indexes

Recommended:

``` ts
{ tabId: 1, createdAt: 1 }
{ tabId: 1, payerId: 1 }
{ tabId: 1, recipientId: 1 }
```

## Future import support

If spreadsheet/CSV import is later added, optionally store:

``` ts
source?: {
  kind: "manual" | "csv" | "xlsx";
  importBatchId?: ObjectId;
  sourceRow?: number;
}
```
