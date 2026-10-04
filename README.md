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
-   `SETUP.md` --- how to install and run the server

## Getting started

**Full step-by-step guide: [SETUP.md](SETUP.md)** (environment file, database, first administrator, phone access, troubleshooting).

Requires Node.js 22.18+ and pnpm.

```sh
pnpm install
cp .env.example .env.local   # then set MONGODB_URI and AUTH_SECRET
pnpm db:local                # optional: local MongoDB, no install needed (leave running)
pnpm create-admin            # once: your administrator account
pnpm dev                     # http://localhost:3000
```

`pnpm db:local` stores data in `.data/mongo` and listens on
`127.0.0.1:27017` only, which matches the default `MONGODB_URI`.

## Accounts

Anyone who can reach the app can create an account at `/register` (name,
email, password of at least 12 characters). Each user sees their own
tabs, plus any tabs friends have shared with them. Administrators can
also view every user's tabs (read-only) and manage accounts under
**Admin**. No emails are sent: there is no
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

## Sharing a tab with friends

On a tab's **Overview**, the owner can share the tab with anyone who has
an account. They type the friend's email and choose an access level:

-   **Can view:** the friend sees everything (people, transactions,
    settlements, exports) but changes nothing.
-   **Can edit:** the friend can also add and change people,
    transactions, payments and splits.

Only the owner can rename or archive the tab, change someone's access,
or stop sharing. Changes take effect right away. The friend finds the
tab under **Shared with you** on their tab list, and can remove it from
their list ("Remove from my tabs"). The friend needs an account first:
no emails are sent, so tell them yourself.

On a shared tab, every transaction says who added it and who last
changed it ("Added by you, edited by Dave"). The line appears under each
row, on settlement card details, and in the CSV. A tab only you use
doesn't show it.

## Deleting and restoring

Deleting a transaction doesn't erase it. Right after a delete you get
**Undo**. Later, open **Recently deleted** under the transactions to see
who deleted what and when, and **Restore** it. Deleted rows don't count
toward any balance. Viewers can see the list but not restore.

## Sharing a summary

On a tab's **Settlements** section:

-   **Share image** makes a PNG of who pays whom and each person's net,
    for group chats. On a phone over HTTPS it opens the share sheet. Over
    plain HTTP (a LAN address) phones can't share files from a web page,
    so it downloads the image instead: on iPhone, open it from Downloads
    and share from there.
-   **Print or save PDF** prints every pair with its transactions. In the
    print dialog, choose "Save as PDF". On iPhone, use Share → Print, then
    pinch out on the preview to get a PDF.
-   **Download CSV** gives every transaction and each pair's balance, for
    spreadsheets.
-   **Copy summary** copies the same summary as plain text.

Anyone who can see the tab can use all four.

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
| `pnpm backup` | Saves users, tabs, people and transactions to `.data/backups/utang-club-<date>/` |
| `pnpm restore <folder>` | Restores a backup into an **empty** database (refuses otherwise) |
| `pnpm typecheck` | Generates route types, then runs `tsc` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit tests and in-memory MongoDB tests) |
| `pnpm check` | Typecheck, lint and tests together |
| `pnpm e2e` | Playwright touch and device suite against a production build (see `TESTING.md`) |
| `pnpm e2e:dev` | The same suite against the dev server |

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | yes | MongoDB connection string. Server-only, never sent to the browser. |
| `AUTH_SECRET` | yes | At least 32 random characters, used to hash client IPs and emails for sign-in throttling |
| `DEV_ALLOWED_ORIGINS` | no | Extra hostnames allowed to load dev assets, comma-separated |
| `ACTION_ALLOWED_ORIGINS` | no | Tunnel or proxy hosts allowed to call Server Actions |

Never commit `.env.local`.
