# MongoDB Data Model

## Tab

``` ts
interface Tab {
  _id: ObjectId;
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
  tokenHash: string;           // SHA-256 of the cookie token (unique)
  passwordFingerprint: string; // must match the current AUTH_PASSWORD_HASH
  lastSeenAt: Date;
  expiresAt: Date;             // sliding 7-day idle expiry (TTL index)
  absoluteExpiresAt: Date;     // hard 30-day cap
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes: `{ tokenHash: 1 }` unique, `{ expiresAt: 1 }` TTL.

## LoginThrottle

Failed-login counters: one document per hashed client IP, plus one
`"global"` document.

``` ts
interface LoginThrottle {
  _id: ObjectId;
  key: string;            // HMAC of the client IP with AUTH_SECRET, or "global"
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
