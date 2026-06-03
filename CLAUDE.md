@AGENTS.md

# Retailo — Retail Shop Management System

Multi-tenant SaaS for Indian/Kerala SMB retail shops. Two surfaces share one codebase:

- **Web** — Next.js 16 App Router (admin console + customer-facing onboarding).
- **Desktop** — Electron wrapper around the same Next standalone server, runs offline once a shop owner has signed in.

Stack: Next.js 16 (Turbopack, App Router) · React 19 · Tailwind v4 · shadcn/ui over **@base-ui/react** (not Radix) · Mongoose 9 (cloud) · better-sqlite3 (local) · JWT (jose) sessions.

## Stack quick-reference

| Concern | Choice |
| --- | --- |
| Cloud store | **MongoDB Atlas** via Mongoose 9 (`lib/mongoose.ts` → `connectCloudDB()` — non-throwing, returns null if unreachable). |
| Local store | **SQLite** via better-sqlite3 (`lib/sqlite.ts`). Schema is inlined as a `SCHEMA_SQL` const so Next NFT tracing doesn't drag the repo into the standalone bundle. |
| Auth | bcrypt against cloud Mongo; `jose` JWT in HttpOnly cookie `rsms_session` (365-day TTL). **DAL reads only from the JWT payload — never touches a DB.** |
| Login policy | **Network required.** `connectCloudDB()` is probed first; if unreachable, `/api/auth/login` returns 503 with "No internet connection. Please connect…". Same for `/api/auth/signup` and the invite-accept flow. |
| Sync | Push (`lib/sync/outbox.ts`) + pull (`lib/sync/pull.ts`) on a 30s tick (`lib/sync/tick.ts`), scoped to the active shop. Last-write-wins by `updated_at`. |
| UI primitives | `@base-ui/react` — composition uses `render` prop, not Radix `asChild`. |
| Forms | **Server actions** for dashboard mutations; API routes only for non-Next clients (search endpoints, exports, auth). |
| Filters | URL search params for filters/pagination; client `useState` only for ephemeral form state. |
| Validation | `zod` in `lib/validators.ts` — every server action / API route parses inputs. |
| Styling | CSS variables in `app/globals.css`. Theme is **forced light**; the `.dark` block is preserved but inactive. Sidebar tokens are black in both blocks. |

## Directory layout

```
app/
  (auth)/                 — login, signup, forgot/reset password (route group, no chrome)
  accept-invite/          — public landing for admin-issued invite tokens
  admin/                  — web-only platform console (ADMIN role)
    layout.tsx            — requireRole(["ADMIN"]) guard
    page.tsx              — stats + quick actions
    shops/                — list/activate/deactivate every shop on the platform
    invites/              — create + revoke onboarding invites
  dashboard/              — shop owner / cashier shell (works in web + electron)
    layout.tsx, page.tsx, products/, inventory/, pos/, customers/, suppliers/,
    purchases/, expenses/, reports/, settings/, profile/, branches/, invoices/
  api/
    auth/                 — login/signup/logout/me/forgot/reset + clear-session helper
    products/search       — POS lookup (Mongoose; pending migration)
    products/export       — CSV (Mongoose)
    customers/search      — POS attach-customer (Mongoose)
    suppliers/search      — purchase form (Mongoose)
    inventory/export      — CSV (Mongoose)
    reports/export        — CSV per report type (Mongoose)

lib/
  dal.ts                  — `getCurrentUser()`, `verifySession()`, `requireRole()` — JWT-only, no DB read
  session.ts              — JWT encode/decode + cookie helpers (365-day TTL)
  mongoose.ts             — `connectCloudDB()` cloud-only, returns null on unreachable
  sqlite.ts               — `getDb()`, `newId()` (UUID), `nowMs()`, `getMeta`/`setMeta`,
                            `pruneOtherShops(activeShopId)`, inlined SCHEMA_SQL
  sync/
    network.ts            — `isCloudReachable()` 5-s probe
    outbox.ts             — `enqueueOutbox(...)`, `drainOutbox()` push to cloud
    pull.ts               — cloud → SQLite, filtered by active shop
    tick.ts               — 30-s background loop; skips if no active shop
  validators.ts           — every zod schema; `LoginSchema.email` accepts any string
  csv.ts, format.ts, utils.ts, api.ts, types.ts
  queries/                — server-only read helpers; admin.ts, products.ts (SQLite),
                            everything else still Mongoose
  actions/                — `"use server"` write helpers; admin.ts (cloud), products.ts
                            (SQLite + outbox), everything else still Mongoose

models/                   — Mongoose schemas; index.ts re-exports all
                            Includes Invite (admin onboarding tokens)

components/
  ui/                     — shadcn primitives over base-ui
  auth/                   — login/signup/forgot/reset/accept-invite forms
  admin/                  — admin-only client components
  dashboard/              — shop shell + per-domain client components

electron/main.js          — production: spawns the Next standalone server with
                            SQLITE_DB_PATH, CLOUD_MONGODB_URI, JWT_SECRET; opens
                            BrowserWindow at http://127.0.0.1:<port>. Dev: loads
                            http://127.0.0.1:3000 directly.

build/                    — electron-builder resources (icon.png, icon.ico,
                            cloud-config.json — last one gitignored)

proxy.ts                  — root-level middleware (renamed in Next 16!); routes
                            ADMIN↔/admin, others↔/dashboard, gates protected paths

scripts/
  seed.ts                 — npm run db:seed / db:reset; demo data + admin + owner + cashier
  prepare-standalone.mjs  — copies .next/static + public into .next/standalone
  build-icon.mjs          — regenerates build/icon.ico from build/icon.png
```

## Tenancy + auth

- `Shop` is the tenant; every shop-scoped doc carries `shopId` (indexed).
- Roles: `ADMIN` (platform, no shopId) / `OWNER` / `MANAGER` / `CASHIER` / `SALES_EXECUTIVE`.
- `proxy.ts`:
  - Unauthed `/dashboard*` or `/admin*` → 307 `/login`.
  - `/admin*` requires `role === "ADMIN"` (others bounced to `/dashboard`).
  - `/dashboard*` for `role === "ADMIN"` bounced to `/admin` (dashboard queries assume a shop).
  - `/accept-invite` is always public; logged-in users aren't pushed off it.
- Server pages call `await getCurrentUser()` — returns JWT fields verbatim, never queries a DB. Don't put role/active checks here; do them at the action/route handler boundary if they matter.
- Login accepts a username OR email — short usernames like `admin` are allowed (`LoginSchema.email` is `min(1)`, not `.email()`).

## SQLite + sync engine

- DB path: `SQLITE_DB_PATH` (Electron sets it to `%APPDATA%/Retailo/rsms.db`; dev falls back to `.data/rsms.db`).
- `SCHEMA_SQL` is **inlined** in `lib/sqlite.ts`. To add a table:
  1. Append to the inlined string with `CREATE TABLE IF NOT EXISTS …` (idempotent — runs on every connection open).
  2. If it's tenant-scoped, add it to `TENANT_TABLES_WITH_SHOP_COL` in `lib/sqlite.ts` so `pruneOtherShops` cleans it on login.
  3. If the cloud also has it, add a mapper to `lib/sync/pull.ts`.
- IDs: SQLite uses **UUID strings** (`newId()`); cloud Mongo uses **ObjectId**. `lib/sync/pull.ts` matches both shapes via `{ $or: [{ shopId: str }, { shopId: ObjectId }] }`.
- `pruneOtherShops(activeShopId)` runs on every login/signup. Drops rows where `shop_id != activeShopId` across all tenant tables, plus clears `sync_pull_state` + `sync_outbox`. Local DB only ever contains the active tenant's data.
- Sync tick skips entirely when no `active_shop_id` meta key is set (no one logged in).
- Conflict resolution: last-write-wins by `updated_at`. Two-PC concurrent edits on the same row will overwrite each other — explicit choice.

## Module migration status (Mongoose → SQLite)

| Module | Reads | Writes | Offline-capable? |
| --- | --- | --- | --- |
| **Auth (login/signup/session/DAL)** | JWT | Cloud (with login probe) | Session works offline; login requires network |
| **Products** | SQLite | SQLite + outbox push | ✅ |
| **Admin (web-only)** | Cloud Mongo | Cloud Mongo | N/A — web requires network anyway |
| Dashboard overview, POS, Inventory, Customers, Suppliers, Purchases, Expenses, Reports, Branches, Settings, Profile | Cloud Mongo | Cloud Mongo | ❌ |

The non-migrated modules **work online** because the desktop's Next server has the cloud URI baked in (via `build/cloud-config.json` → `electron/main.js`). They **fail offline** until each gets the Products treatment.

## Adding a new domain module

Two variants depending on offline requirements.

### Variant A — Mongoose-only (online required; everything except Products today)

1. **Model** in `models/<Name>.ts` — `shopId` indexed, `models.Foo || model("Foo", schema)`. Re-export from `models/index.ts`.
2. **Validator** in `lib/validators.ts` — zod schemas for create/update.
3. **Query** in `lib/queries/<name>.ts` — `"server-only"`, `await connectCloudDB()`, return plain objects (stringify `_id`s).
4. **Action** in `lib/actions/<name>.ts` — `"use server"`, validate with zod, scope by `user.shopId`, `revalidatePath()` on success. Return `{ ok: true } | { ok: false; error }`.
5. **Page** in `app/dashboard/<route>/page.tsx` — server component, parse `searchParams`, call query, render.
6. **Forms** in `components/dashboard/<name>/` — client components passing `FormData` to the action.

### Variant B — SQLite + cloud sync (offline-capable; follow `products`)

1. Schema rows in `lib/sqlite.ts`'s `SCHEMA_SQL` + add table to `TENANT_TABLES_WITH_SHOP_COL`.
2. Mapper in `lib/sync/pull.ts` so cloud writes flow back into SQLite.
3. Query in `lib/queries/<name>.ts` reads from SQLite (`getDb()`).
4. Action writes to SQLite **and** calls `enqueueOutbox("collection", id, "upsert"|"delete", payload)`.
5. Validator + page + forms as in Variant A.

The Mongoose model is still authoritative cloud-side; sync round-trips through it on push and on initial pull.

## Server actions vs API routes

- **Server actions** (`lib/actions/`) for all dashboard + admin mutations — auto-revalidate, no fetch boilerplate, no API surface to secure.
- **API routes** (`app/api/`) only for:
  - Auth flow (login/signup/logout/me/forgot/reset/clear-session) — needs to set cookies cleanly.
  - Client-side search (`/api/products/search`, `/api/customers/search`, `/api/suppliers/search`).
  - File downloads (`/api/products/export`, `/api/reports/export`, etc. — return `csvResponse()`).

## Admin module (web-only)

- Lives under `/admin` (sidebar entries: Overview, Shops, Invites).
- `ADMIN` role users — `shopId === null`. Created via seed (`admin@retailo.in / admin1234`) or imperatively (the `admin / byzaman01` account was upserted directly).
- **Invitation flow:**
  1. ADMIN fills the form in `/admin/invites` (owner email/name/phone + shop name/type). `createInvite` generates a 24-byte URL-safe token, 7-day TTL.
  2. Dialog shows the shareable link `/accept-invite?token=…`. ADMIN copies it to the owner (WhatsApp etc.).
  3. Owner opens link → `app/accept-invite/page.tsx` shows the pre-filled shop preview + password form.
  4. `acceptInvite` server action validates the token, creates `User` + `Shop` + `Branch`, marks the invite `ACCEPTED`, and auto-logs in the new owner.
- `Invite` model in `models/Invite.ts` (statuses: `PENDING` / `ACCEPTED` / `REVOKED` / `EXPIRED`). `listInvites` auto-expires stale `PENDING` rows on read.
- Admin module is **web-only by convention** — there's no UI affordance to it in Electron, and admins don't have a shop, so /dashboard would be empty for them. Nothing in the codebase physically blocks typing `/admin` in the Electron browser.

## Electron desktop

- Entry: `electron/main.js`. Production mode spawns the Next standalone server (`server.js`) as a child process with `SQLITE_DB_PATH`, `CLOUD_MONGODB_URI`, `JWT_SECRET` env vars, then opens a `BrowserWindow` at `http://127.0.0.1:<freePort>`.
- `build/cloud-config.json` (gitignored) ships in `extraResources` and supplies the cluster URI to the installed app. Dev mode reads the URI from `.env`.
- `next.config.ts` has `output: "standalone"` and lists `better-sqlite3` + `mongoose` in `serverExternalPackages` so the native + heavy modules aren't bundled.
- `npm run dist` chains `next build` → `prepare-standalone` (copies `.next/static` and `public` into the standalone tree) → `electron-builder --win --x64` → `postdist` (`npm rebuild better-sqlite3` to restore the macOS binary after cross-compile).
- Installer is **NSIS, unsigned, ~168 MB**, output at `dist/Retailo-Setup-<version>.exe`. See `ELECTRON.md` for the full runtime architecture.

## UI conventions

- **`@base-ui/react` composition uses `render`, not `asChild`**. Examples in `components/ui/sheet.tsx`, `components/ui/dropdown-menu.tsx`. Pass `nativeButton={false}` when rendering as `<a>` / `<Link>`.
- **Tables** use `components/ui/table.tsx` primitives. List pages: *server* page owns filters via `searchParams`; *client* toolbar updates URL with `router.replace()`.
- **Forms** use `Sheet` (slide-out, e.g. product/employee/customer/supplier) for create/edit, `Dialog` (centered modal) for confirm/quick-action (delete, pay-salary, adjust-stock, quick-add product, invite owner).
- **Theme tokens** (use these, don't hard-code colors): `bg-card`, `bg-muted`, `bg-sidebar` (always black), `bg-primary` / `text-primary` (indigo accent), `text-muted-foreground`, `border` / `border-sidebar-border`.

## Mongoose patterns

- `await connectCloudDB()` (NOT `connectDB`) at the top of any server file that hits cloud Mongo. It returns `null` if unreachable — every caller must handle the null case or short-circuit.
- `findOneAndUpdate(..., { returnDocument: "after" })` — `{ new: true }` is deprecated and spams warnings.
- Atomic stock decrement on sale uses `findOneAndUpdate` with `quantity: { $gte: needed }`; throws if insufficient. POS wraps the whole sale in a `startSession()` transaction with sequential fallback for non-replicaset Mongo. (This is in the Mongoose-only POS module — moves to SQLite when that module migrates.)
- Branch-aware queries: filter by both `shopId` AND `branchId` in `Inventory` lookups.

## Toggles to know about

- **`Shop.gstEnabled`** — when `false`, GST/HSN UI is suppressed across Products, POS, Purchase, Print invoice, and Reports. Server pages call `await isGstEnabled(shopId)` from `lib/queries/shop.ts` and pass the boolean down. Client components like `<PosApp>` and `<PurchaseForm>` accept it as a prop and skip both the UI **and** the tax math (forcing `gstRate=0` in payloads). Existing values are preserved so re-enabling restores everything.
- **`forcedTheme="light"`** in `app/layout.tsx`'s ThemeProvider — overrides any stored localStorage theme. The dark palette in `globals.css` is intentional dead code retained for a future toggle.
- **`active_shop_id`** in the SQLite `app_meta` table — set by login/signup, cleared by logout. Sync tick and `pruneOtherShops` both key off it.

## Dev commands

```bash
npm run dev          # Next dev (web) — :3000
npm run devapp       # Next dev + Electron in parallel (concurrently + wait-on)
npm run electron     # Electron pointed at running :3000

npm run build        # Web production build
npm run build:desktop # next build + prepare-standalone (no electron-builder)
npm run dist         # Full Windows installer pipeline → dist/Retailo-Setup-<ver>.exe
npm run dist:portable # Portable .exe variant

npm run db:seed      # Seed cloud Mongo with admin + owner + cashier + demo data
npm run db:reset     # Wipe + reseed
npm run lint         # ESLint
```

## Known footguns

- After `npm run dist`, `better-sqlite3`'s `.node` binary is left compiled for **Windows**. `postdist` (`npm rebuild better-sqlite3`) auto-restores the Mac binary. If `npm run dev` fails with `ERR_DLOPEN_FAILED`, run it manually.
- Orphan dev servers: Next refuses to start a second `next dev` in the same project. `npm run devapp` will fail silently if a stale dev server is still on :3000. `pkill -f "next dev"` to clean up.
- The SQLite connection is cached on `globalThis._rsmsSqlite`. The cached connection was opened against whatever schema existed at first call — restart `next dev` after editing `SCHEMA_SQL` if a new table doesn't appear.
- `app/api/auth/clear-session/route.ts` exists because server components can't mutate cookies. Don't call `deleteSession()` from `lib/dal.ts` or any page render — redirect to the route handler instead.

## Out-of-scope items (currently deferred)

Listed in `phase_roadmap.md` memory. Most notable: migrating POS/Inventory/Sales/Customers/Suppliers/etc. modules to SQLite so the desktop is fully offline; image upload backend; CSV import; real PDF/`.xlsx` exports; thermal-printer ESC/POS; UPI QR rendering; purchase returns; branch transfers; WhatsApp share; Malayalam i18n.
