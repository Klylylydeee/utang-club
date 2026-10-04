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

## Accounts

Anyone who can reach the app can create an account at `/register` (name,
email, password of at least 12 characters). Each user sees only their own
tabs. Administrators can also view every user's tabs (read-only) and
manage accounts under **Admin**. No emails are sent: there is no
verification and no "forgot password"; an administrator sets a new
password instead.

**First-time setup**

1.  Make sure `.env.local` has `MONGODB_URI` and `AUTH_SECRET`.
2.  Run `pnpm create-admin` in an interactive terminal. Enter your
    email. If you already registered, that account is promoted to
    administrator; otherwise it asks for your name and a password (not
    echoed) and creates the account.
3.  The script also assigns every tab created before accounts existed
    to that administrator, and prints an `AUTH_SECRET` if one is missing.
4.  Restart `pnpm dev` / `pnpm start` if you changed `.env.local`.

**Managing users (Admin → open a user):** disable or enable the account
(disabling signs them out everywhere and keeps their tabs), make them an
administrator or remove admin access, or set a new password (this also
signs them out everywhere). Administrators can't change their own
account, so there is always at least one active administrator.

**Signing out:** the account menu (your initials, top right) has "Sign
out", which signs out this device.

**Lockouts:** 5 failed sign-ins in 15 minutes from one device, or for one
account, lock that device or account out (5 minutes, doubling up to 1
hour). 20 failures from everyone combined locks all sign-ins briefly.
Registration has its own limit per device. Waiting it out is the only
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
| `pnpm create-admin` | Creates or promotes an administrator and claims tabs made before accounts |
| `pnpm typecheck` | Generates route types, then runs `tsc` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit tests and in-memory MongoDB tests) |
| `pnpm check` | Typecheck, lint and tests together |

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | yes | MongoDB connection string. Server-only, never sent to the browser. |
| `AUTH_SECRET` | yes | At least 32 random characters, used to hash client IPs and emails for sign-in throttling |
| `DEV_ALLOWED_ORIGINS` | no | Extra hostnames allowed to load dev assets, comma-separated |
| `ACTION_ALLOWED_ORIGINS` | no | Tunnel or proxy hosts allowed to call Server Actions |

Never commit `.env.local`.
