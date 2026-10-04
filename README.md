# Utang Club

A personal Next.js + MongoDB project for entering shared-expense
transactions and automatically calculating pairwise settlements.

## Core idea

Input: `Description | Foreign Amount | PHP Amount | To Pay | To Be Paid`

Output: grouped and netted settlement cards such as:
`Adrian -> Klyde: ₱3,885.10`

See `CODEX_PROMPT.md` for the recommended first prompt to give Codex.

## Documentation

-   `AGENTS.md` --- repository instructions for Codex
-   `REQUIREMENTS.md` --- product requirements
-   `SETTLEMENT_RULES.md` --- exact calculation behavior
-   `DATA_MODEL.md` --- MongoDB model
-   `ARCHITECTURE.md` --- Next.js architecture
-   `UI_SPEC.md` --- interface specification
-   `TESTING.md` --- test cases
-   `PLAN.md` --- implementation milestones
-   `PHASING.md` --- phases, working decisions, exit criteria

## Getting started

Requires Node.js 22+ and pnpm.

```sh
pnpm install
cp .env.example .env.local   # then set MONGODB_URI
pnpm db:local                # optional: local MongoDB, no install needed (leave running)
pnpm dev                     # http://localhost:3000
```

`pnpm db:local` stores data in `.data/mongo` and listens on
`127.0.0.1:27017` only, which matches the default `MONGODB_URI`.

## Sign-in

The whole app sits behind a single owner password. There are no user
accounts and no email reset. The password itself is never stored; only
a scrypt hash in `.env.local`.

1.  Run `pnpm hash-password` in an interactive terminal. It asks for the
    password twice (at least 12 characters) without echoing it.
2.  It prints two lines. Paste both into `.env.local`:

    ```sh
    AUTH_PASSWORD_HASH=scrypt:...
    AUTH_SECRET=...
    ```

3.  Restart `pnpm dev` / `pnpm start`.

Until both values are set, the login page shows "Sign-in isn't set up
yet".

**Changing the password:** run `pnpm hash-password` again and replace
only `AUTH_PASSWORD_HASH`, then restart. Every existing session is tied
to the old hash, so this signs out every device. Keep the same
`AUTH_SECRET`; it only hashes client IPs for login throttling and has no
effect on the password.

**Signing out:** the Account menu has "Sign out" (this device) and "Sign
out on all devices".

**Lockouts:** 5 failed attempts from one client in 15 minutes locks that
client out (5 minutes, doubling up to 1 hour). 20 failures from all
clients combined locks every login briefly. Waiting it out is the only
way to unlock.

## Open it on your phone

`pnpm dev` and `pnpm start` both listen on every network interface. To
open the app on a phone:

1.  Connect the phone to the same Wi-Fi as this computer.
2.  Find this computer's LAN IP (`ipconfig` on Windows). It looks like
    `192.168.x.x`.
3.  On the phone, open `http://<LAN-IP>:3000`.
4.  The first time, Windows Firewall asks whether to allow Node.js.
    Allow it on **private networks only**.

The dev server allows this machine's LAN IPs automatically. For a
tunnel or another hostname, set `DEV_ALLOWED_ORIGINS` (dev assets) and
`ACTION_ALLOWED_ORIGINS` (form submissions) in `.env.local`.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Dev server, reachable on the LAN |
| `pnpm build` / `pnpm start` | Production build and server, reachable on the LAN |
| `pnpm db:local` | Persistent local MongoDB for development |
| `pnpm hash-password` | Generates `AUTH_PASSWORD_HASH` and `AUTH_SECRET` |
| `pnpm typecheck` | Generates route types, then runs `tsc` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit tests and in-memory MongoDB tests) |
| `pnpm check` | Typecheck, lint and tests together |

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | yes | MongoDB connection string. Server-only, never sent to the browser. |
| `AUTH_PASSWORD_HASH` | yes | scrypt hash of the owner password, from `pnpm hash-password` |
| `AUTH_SECRET` | yes | At least 32 random characters, used to hash client IPs for login throttling |
| `DEV_ALLOWED_ORIGINS` | no | Extra hostnames allowed to load dev assets, comma-separated |
| `ACTION_ALLOWED_ORIGINS` | no | Tunnel or proxy hosts allowed to call Server Actions |

Never commit `.env.local`.
