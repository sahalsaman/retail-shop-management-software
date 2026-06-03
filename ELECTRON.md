# RETAILO Desktop (Electron) — Windows .exe build

## Architecture

- **Local store:** SQLite at `%APPDATA%/RETAILO/rsms.db`. Primary source of truth at runtime — every read goes here, every write goes here first.
- **Cloud store:** MongoDB Atlas (or any Mongo URI you bake in). Used for:
  1. **Login** (always — see "Network-only login" below).
  2. **Background sync** — push local writes (outbox) + pull cloud updates. Last-write-wins by `updated_at`.
- **Server:** Next.js standalone build, spawned by Electron's main process as a child.
- **Renderer:** the Electron BrowserWindow loads `http://127.0.0.1:<port>` from that server.

```
┌──────────── Electron main (electron/main.js) ────────────┐
│                                                          │
│  spawns ──►  Next standalone server (server.js)          │
│              ├─ better-sqlite3 → %APPDATA%/RETAILO/rsms.db  │
│              └─ mongoose      → CLOUD_MONGODB_URI        │
│                                  (best-effort, optional) │
│                                                          │
│  BrowserWindow ──► http://127.0.0.1:<port>               │
└──────────────────────────────────────────────────────────┘
```

## Network-only login

`/api/auth/login` always contacts cloud Mongo:

- If cloud is unreachable → `503` with "Login requires an internet connection."
- If reachable → bcrypt-verify the password against the cloud `users` collection. On success, the user + their shop + branches are upserted into local SQLite so the rest of the app works offline.

A per-install random `JWT_SECRET` is generated at first launch and persisted to `%APPDATA%/RETAILO/jwt.secret`. Sessions are 365-day cookies, so the user stays logged in across app close / system off until they hit Logout.

## Background sync

`lib/sync/tick.ts` starts a 30s interval after login. Each tick:

1. `isCloudReachable()` — ping the cloud admin endpoint with a 5s timeout.
2. If reachable: `drainOutbox()` pushes pending local writes, then `pullAll()` pulls any cloud docs newer than our high-water mark per collection.

**Conflict resolution: last-write-wins.** Two cashiers editing the same product offline → whichever sync completes second overwrites the first. This is documented and accepted (see initial scope conversation).

The outbox table (`sync_outbox`) holds pending writes with `attempts` / `last_error` columns; failed pushes are retried up to 8 times before being parked.

## Migration status

| Module | Reads | Writes | Notes |
| --- | --- | --- | --- |
| Auth (login/session/DAL) | ✅ SQLite | ✅ Cloud + SQLite cache | Network required for login |
| Products | ✅ SQLite | ✅ SQLite + outbox | Cloud pull mapped in `lib/sync/pull.ts` |
| POS, Inventory, Sales, Customers, Suppliers, Purchases, Expenses, Reports, Employees, Branches, Settings, Profile | ⚠️ Cloud Mongoose | ⚠️ Cloud Mongoose | **Will fail offline** until migrated |

The non-migrated modules still work *online* because `connectCloudDB()` falls back to `MONGODB_URI` and Mongoose continues to function. They will throw "no cloud" errors when offline. Migrate them one at a time following the pattern in `lib/queries/products.ts` + `lib/actions/products.ts` + `lib/sync/pull.ts`.

## Building from this Mac

You're cross-compiling Windows on macOS, so you need Wine.

```bash
# One-time:
brew install --cask --no-quarantine wine-stable

# Whenever you build:
npm install
CLOUD_MONGODB_URI="mongodb+srv://…" npm run dist
# → dist/RETAILO-Setup-0.1.0.exe
```

`CLOUD_MONGODB_URI` at build time is baked into the installer via electron-builder's env passthrough. Without it, the installed app can't log anyone in. If you'd rather configure per-PC after install, drop `%APPDATA%/RETAILO/cloud.env` containing `CLOUD_MONGODB_URI=…` — `electron/main.js` will need a small tweak to read it (not done yet).

## Developing the desktop shell locally

In dev, the existing `.env` is used as-is (cloud Mongo connection), but SQLite is now active too — it falls back to `.data/rsms.db` at repo root when `SQLITE_DB_PATH` is unset.

```bash
npm run devapp    # starts `next dev` and Electron together
```

Electron's main process detects `!app.isPackaged` and just loads `http://127.0.0.1:3000`.

## Native module (`better-sqlite3`)

`better-sqlite3` ships a precompiled `.node` binary. Things to know:

- `next.config.ts` lists it in `serverExternalPackages` so Next doesn't try to bundle it.
- `electron-builder` rebuilds it against Electron's Node ABI automatically during `dist`. If you switch Electron major versions, run `npx @electron/rebuild` once after install.
- On dev (`next dev` outside Electron), `npm install` builds it against the system Node — no extra step.

## Troubleshooting

- **"Login requires an internet connection"** — check `CLOUD_MONGODB_URI` is set and reachable. The cloud probe uses a 5s timeout.
- **App opens but data pages crash offline** — that module hasn't been migrated to SQLite yet. See the migration table above.
- **Standalone server can't load schema.sql** — make sure `scripts/prepare-standalone.mjs` copied `db/` into `.next/standalone/db/`. It does this automatically as part of `npm run build:desktop`.

## Files map

| File | Purpose |
| --- | --- |
| `electron/main.js` | Spawns Next, opens window. No mongod. |
| `next.config.ts` | `output: "standalone"` + `serverExternalPackages` |
| `db/schema.sql` | SQLite table DDL — bootstrapped on first connection |
| `lib/sqlite.ts` | Connection + UUID + nowMs helpers |
| `lib/mongoose.ts` | Cloud Mongo client (non-throwing) |
| `lib/sync/network.ts` | `isCloudReachable()` |
| `lib/sync/outbox.ts` | `enqueueOutbox()` + `drainOutbox()` |
| `lib/sync/pull.ts` | Per-collection cloud → SQLite pull |
| `lib/sync/tick.ts` | 30s background loop |
| `app/api/auth/login/route.ts` | Network-only login + SQLite cache |
| `lib/dal.ts` | Reads user from SQLite |
| `lib/queries/products.ts` | SQLite read (list + detail) |
| `lib/actions/products.ts` | SQLite write + outbox enqueue |
| `scripts/prepare-standalone.mjs` | Copies static / public / db into standalone bundle |
| `package.json` → `build` | electron-builder config (NSIS, x64) |
