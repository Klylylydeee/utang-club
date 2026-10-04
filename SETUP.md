# Setting up Utang Club

This guide takes you from a fresh copy of the code to a running server
with an administrator account, then shows how to open it on a phone and
how to fix the common problems. It assumes basic comfort with a
terminal.

Commands are written for **PowerShell or Windows Terminal**. They work
the same in macOS/Linux terminals except where noted.

## 1. Install the tools

You need:

- **Node.js 22.18 or newer** (24 recommended). The setup scripts are
  TypeScript files that Node runs directly, which older versions can't
  do. Check with:

  ```sh
  node -v
  ```

- **pnpm 12.** The project pins its version, and Node's Corepack installs
  it for you:

  ```sh
  corepack enable
  pnpm -v
  ```

- **MongoDB.** You don't have to install it. Step 4 shows how to run a
  local copy with one command. You can also use an existing MongoDB
  server or a free MongoDB Atlas cluster.

## 2. Install the project's packages

From the project folder:

```sh
pnpm install
```

## 3. Create `.env.local`

`.env.local` holds this server's settings and secrets. It is ignored by
git, so it is never committed.

1. Copy the template:

   ```sh
   copy .env.example .env.local      # PowerShell / cmd
   cp .env.example .env.local        # macOS / Linux / Git Bash
   ```

2. Generate a secret for `AUTH_SECRET`:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

3. Open `.env.local` and fill it in:

   ```sh
   MONGODB_URI=mongodb://127.0.0.1:27017/utang-club
   AUTH_SECRET=paste-the-value-from-step-2
   DEV_ALLOWED_ORIGINS=
   ACTION_ALLOWED_ORIGINS=
   ```

| Setting | Required | What it's for |
|---------|----------|---------------|
| `MONGODB_URI` | yes | Where the database is. The default matches step 4. For Atlas, paste the `mongodb+srv://…` string Atlas gives you. |
| `AUTH_SECRET` | yes | At least 32 random characters. Used to protect sign-in against password guessing. Keep it secret. Changing it later only resets the guessing counters; nobody is signed out. |
| `DEV_ALLOWED_ORIGINS` | no | Extra hostnames allowed to load the dev server, comma-separated. This computer's network addresses are allowed automatically, so you can usually leave it empty. |
| `ACTION_ALLOWED_ORIGINS` | no | Only for a tunnel or reverse proxy (for example `utang.example.com`). **Leave it empty otherwise, and never set it to `*`**: that lets any website submit changes to your app. |

`AUTH_PASSWORD_HASH` from older versions is no longer used. Delete it if
it's still there.

## 4. Start the database

Skip this step if `MONGODB_URI` points to a MongoDB you already run.

In a **separate terminal**, start the local database and leave it
running:

```sh
pnpm db:local
```

You should see:

```text
Local MongoDB running at mongodb://127.0.0.1:27017/utang-club
Data directory: …\.data\mongo
Press Ctrl+C to stop.
```

- The first run downloads the MongoDB program (a large download). Later
  runs start in seconds.
- Data is stored in `.data/mongo` inside the project and survives
  restarts. It only listens on this computer (`127.0.0.1`), never on the
  network.
- On Windows on ARM there's no native MongoDB build, so it runs the
  x64 one under emulation automatically.

If it says **"Something is already listening on 127.0.0.1:27017"**,
another MongoDB is running:

- If it's an earlier `pnpm db:local`, you're done. The database is
  already up.
- If it's another MongoDB (for example a Windows service), either stop
  that one, or run this one on another port and point the app at it:

  ```powershell
  $env:LOCAL_DB_PORT = 27018; pnpm db:local
  ```

  ```sh
  MONGODB_URI=mongodb://127.0.0.1:27018/utang-club
  ```

## 5. Create the administrator account

Run this once, in an **interactive terminal** (Windows Terminal or
PowerShell, not an IDE output panel), with the database running:

```sh
pnpm create-admin
```

It asks for your email, then:

- **If no account uses that email yet**, it asks for your name and a
  password (at least 12 characters, typed twice, not shown on screen)
  and creates an administrator account.
- **If you already registered in the app**, it makes that account an
  administrator and leaves your password unchanged.

It also:

- assigns every tab created before accounts existed to this
  administrator, so nothing from the single-password version is lost;
- removes sign-in sessions left over from that version;
- prints an `AUTH_SECRET` line if `.env.local` doesn't have one yet.
  Paste it in, then restart the server.

You can run it again at any time to promote another existing account.
There is no other seed data; you create tabs in the app.

## 6. Run the server

In another terminal, while `pnpm db:local` keeps running:

**For everyday use and development:**

```sh
pnpm dev
```

**For the faster production build:**

```sh
pnpm build
pnpm start
```

Then open <http://localhost:3000> and sign in with the administrator
account from step 5.

Both commands listen on every network interface, so other devices on
your Wi-Fi can connect (step 7). Only one `pnpm dev` can run in this
folder at a time; if Next.js says another server is already running,
use that one or stop it first.

## 7. Open it on your phone

1. Connect the phone to the same Wi-Fi as this computer.
2. Find this computer's address. Run `ipconfig` and look for the
   **IPv4 Address**, something like `192.168.1.23`.
3. On the phone, open `http://<that address>:3000`.
4. The first time, Windows Firewall asks whether to allow Node.js. Allow
   it on **private networks only**.

Over `http://` the connection isn't encrypted. On your own Wi-Fi
that's expected. Don't expose the app to the internet without HTTPS in
front of it (for example a Cloudflare Tunnel or Tailscale).

## 8. Add users

- **Anyone who can reach the app** can create an account with **Create
  an account** on the sign-in page. Each user sees their own tabs, and
  any tab its owner shared with them (Overview → Sharing, view or edit).
- **Administrators** see an **Admin** item in the top bar. From there
  they can open any user to view their tabs (read-only), disable or
  enable the account, make them an administrator, or set a new password.
- There is **no email** (no verification, no "forgot password"). If
  someone forgets their password, an administrator sets a new one and
  tells them.

## 9. Check everything works (optional)

```sh
pnpm check
```

This runs the type checker, the linter and all automated tests. The
database tests start their own temporary MongoDB, so they don't touch
your data.

To also run the browser suite (phones and desktop, by touch):

```sh
pnpm e2e
```

It builds the app into `.next-e2e` and runs it on port 3217 with its own
throwaway database, so it can run while your `pnpm dev` is up. It needs
Microsoft Edge on Windows on ARM (Playwright's own Chromium is x64 only)
and Playwright's WebKit. If WebKit is missing, run
`pnpm exec playwright install webkit`.

## Day-to-day

After the first setup, starting the app is two terminals:

```sh
pnpm db:local     # terminal 1, leave running
pnpm dev          # terminal 2
```

To stop, press **Ctrl+C** in each terminal. Your data stays in
`.data/mongo`.

**Back up your data** while the database is running:

```sh
pnpm backup
```

This writes users, tabs, people and transactions to a dated folder such
as `.data/backups/utang-club-2026-10-04T12-30-05`. Copy that folder
somewhere safe (another drive, cloud storage). It contains password
hashes, so keep it private. Sign-in sessions aren't backed up; everyone
signs in again after a restore.

**To restore**, start from an empty database (see *Starting fresh*
below), start `pnpm db:local`, then:

```sh
pnpm restore .data/backups/utang-club-2026-10-04T12-30-05
```

Restore refuses to run if the database already has data, so it can
never overwrite or mix with what's there.

Copying the `.data/mongo` folder while `pnpm db:local` is stopped
also works as a full backup.

## Troubleshooting

| What you see | Cause and fix |
|--------------|---------------|
| Sign-in waits about 5 seconds, then "Something went wrong. Please try again." | The app can't reach MongoDB. Start `pnpm db:local` (step 4), or check `MONGODB_URI`. The terminal running the app shows the real error on a `[login] failed:` line. |
| "Accounts aren't set up on this server yet." | `AUTH_SECRET` is missing or shorter than 32 characters. Fix it in `.env.local` (step 3) and restart the server. |
| "That email and password don't match." even with the right password | After 5 wrong tries in 15 minutes, that device and that account are locked for 5 minutes (doubling up to an hour). The message stays the same on purpose. Wait, then try again. |
| "This account is disabled." | An administrator disabled it. Another administrator can enable it under Admin. |
| `pnpm create-admin` says "Run this in an interactive terminal…" | It's running somewhere that can't hide typing. Use Windows Terminal or PowerShell directly. |
| `pnpm create-admin` says `MONGODB_URI is not set` | Run it from the project folder, where `.env.local` lives. |
| `DBPathInUse` or "Another MongoDB is already using …\.data\mongo" | `pnpm db:local` is already running in another terminal. Use that one. |
| The page looks out of date after an update | Hard-refresh with **Ctrl+Shift+R**. If that doesn't help, stop `pnpm dev` and start it again. |
| A phone can't connect | Same Wi-Fi? Correct IP and `:3000`? Allow Node.js through Windows Firewall on private networks. |

## Starting fresh

To delete **all** data (every user, tab and transaction):

1. Stop `pnpm db:local`.
2. Delete the `.data/mongo` folder.
3. Start `pnpm db:local` again and repeat step 5.
