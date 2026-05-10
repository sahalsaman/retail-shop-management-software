@AGENTS.md

# RSMS — Retail Shop Management System

Multi-tenant SaaS for Indian/Kerala SMB retail shops. Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/ui (over **@base-ui/react**, not Radix) + Mongoose 9 + JWT (jose) sessions.

## Stack quick-reference

| Concern | Choice |
| --- | --- |
| ORM | Mongoose 9 (transactions + `$lookup` aggregations needed) |
| Auth | `jose` JWT in HttpOnly cookie `rsms_session`; verified via `lib/dal.ts` |
| UI primitives | `@base-ui/react` — composition is via `render` prop, not Radix `asChild` |
| Forms | **Server actions** for dashboard mutations; API routes only for things called from non-Next clients (search endpoints, exports) |
| State | URL search params for filters/pagination; client `useState` only for ephemeral form state |
| Validation | `zod` in `lib/validators.ts` — every server action / API route parses inputs |
| Styling | CSS variables in `app/globals.css`. Theme is **forced light** at the provider level (`forcedTheme="light"`); the `.dark` block is preserved but not active. **Sidebar tokens are black in both light and dark blocks** — same look regardless. |

## Directory layout

```
app/
  (auth)/                 — login, signup, forgot/reset password (route group, no layout chrome)
  dashboard/              — authenticated app shell with sidebar + sticky topbar
    layout.tsx            — black sticky sidebar + light-gray topbar + white content card
    page.tsx              — overview widgets (today/month sales, low stock, top products, 7-day bars)
    products/             — CRUD list + sheet form, taxonomies dialog, CSV export
    inventory/            — branch-aware stock + adjust dialog (with batch/expiry)
    pos/                  — billing UI + held bills + print/[id] invoice page
    customers/            — list + ledger detail
    suppliers/            — list + ledger detail
    purchases/            — list + new invoice form
    expenses/             — list + dialog form
    reports/              — sales/profit/GST/stock views with date-range toolbar
    settings/             — ?section=profile|tax|employees, multi-section page
    profile/              — user profile + change password + sign out
    branches/             — placeholder (Phase 6)
  api/
    auth/                 — login/signup/logout/me/forgot/reset
    products/search       — POS lookup (returns branch stock)
    products/export       — CSV
    customers/search      — POS attach-customer
    suppliers/search      — purchase form
    inventory/export      — CSV
    reports/export        — CSV per report type

lib/
  dal.ts                  — `getCurrentUser()` (cached), `verifySession()`, `requireRole()`
  session.ts              — JWT encode/decode + `getSessionFromCookies()`
  mongoose.ts             — globalThis-cached `connectDB()` (always call before model ops)
  validators.ts           — every zod schema lives here; one source of truth
  csv.ts                  — minimal RFC-4180-ish CSV writer (no external dep)
  format.ts               — INR + Indian locale date formatters
  utils.ts                — `cn()` (clsx + tailwind-merge)
  api.ts                  — `ok()`/`fail()`/`handleError()` for legacy API routes
  types.ts                — shared enums (ROLES, PAYMENT_METHODS, STOCK_MOVEMENT_TYPES, …)
  queries/                — server-only read helpers; one file per domain
  actions/                — `"use server"` write helpers; one file per domain

models/                   — Mongoose schemas; index.ts re-exports all
  index.ts                — barrel; always import from "@/models"

components/
  ui/                     — shadcn primitives over base-ui (button, input, sheet, dialog, dropdown-menu, …)
  auth/                   — login/signup forms
  dashboard/              — shell + per-domain client components, organized by domain folder

proxy.ts                  — root-level (renamed from middleware.ts in Next 16!); optimistic auth redirect only — real checks happen in DAL

scripts/seed.ts           — `npm run db:seed` / `db:reset`; realistic Indian retail data
```

## Tenancy + auth

- `Shop` is the tenant; every domain doc carries `shopId` (indexed). Always filter by `user.shopId` in queries.
- Roles: `ADMIN` (platform, no shopId) / `OWNER` / `MANAGER` / `CASHIER` / `SALES_EXECUTIVE`.
- Server pages call `await getCurrentUser()` from `@/lib/dal` — it redirects to `/login` if no session, returns `{ id, name, email, role, shopId, branchId }`.
- `proxy.ts` does optimistic redirects only. **Authoritative auth checks happen at the data layer.** Don't rely on proxy for security.

## Adding a new domain module

Pattern (same one used by every existing module — copy from `products` or `customers`):

1. **Model** in `models/<Name>.ts` — required `shopId` index, `models.Foo || model("Foo", schema)`. Re-export from `models/index.ts`.
2. **Validator** in `lib/validators.ts` — zod schema(s) for create/update.
3. **Query** in `lib/queries/<name>.ts` — `"server-only"`, `await connectDB()`, return plain objects (stringify `_id`s).
4. **Action** in `lib/actions/<name>.ts` — `"use server"`, validate with zod, scope by `user.shopId`, `revalidatePath()` on success. Return `{ ok: true } | { ok: false; error }`.
5. **Page** in `app/dashboard/<route>/page.tsx` — server component, parse `searchParams`, call query, render. Use `<Table>` + `<PaginationControls>` + a `<DataToolbar>` client component.
6. **Forms** in `components/dashboard/<name>/` — client components that pass `FormData` to the action; show toasts via `sonner` and call `router.refresh()`.

## Server actions vs API routes

- **Server actions** (`lib/actions/`) for all dashboard mutations — they auto-revalidate, no fetch boilerplate, no API surface to secure.
- **API routes** (`app/api/`) only for:
  - Search endpoints used by client components (`/api/products/search`, `/api/customers/search`, `/api/suppliers/search`)
  - File downloads (`/api/products/export`, `/api/reports/export`, etc. — return `csvResponse()`)
  - The original auth flow (kept as-is from Phase 1)

## UI conventions

- **`@base-ui/react` composition uses `render`, not `asChild`**. Examples in `components/ui/sheet.tsx`, `components/ui/dropdown-menu.tsx`. Pass `nativeButton={false}` when rendering as `<a>`/`<Link>`.
- **Tables** use `components/ui/table.tsx` primitives. List pages have a *server* page that owns filters via `searchParams` and a *client* `<Toolbar>` that updates URL params with `router.replace()`.
- **Forms** use `Sheet` (slide-out, e.g. product/employee/customer/supplier) for create/edit, `Dialog` (centered modal) for confirm/quick-action (delete, pay-salary, adjust-stock).
- **Theme tokens** (use these, don't hard-code colors): `bg-card` (white surfaces), `bg-muted` (light gray header), `bg-sidebar` (always black), `bg-primary` / `text-primary` (indigo accent), `text-muted-foreground`, `border` / `border-sidebar-border`.

## Mongoose patterns

- Always `await connectDB()` at the top of any server file that hits the DB.
- `findOneAndUpdate(..., { returnDocument: "after" })` — `{ new: true }` is deprecated and spams warnings.
- Atomic stock decrement on sale uses `findOneAndUpdate` with `quantity: { $gte: needed }` filter; throws if insufficient. POS wraps the whole sale in a `startSession()` transaction with sequential fallback for non-replicaset Mongo.
- Branch-aware queries: filter by both `shopId` AND `branchId` in `Inventory` lookups.

## Toggles to know about

- **`Shop.gstEnabled`** — when `false`, GST/HSN UI is suppressed across Products, POS, Purchase, Print invoice, and Reports. Server pages call `await isGstEnabled(shopId)` from `lib/queries/shop.ts` and pass the boolean down. Client components like `<PosApp>` and `<PurchaseForm>` accept it as a prop and skip both the UI **and** the tax math (forcing `gstRate=0` in payloads). Existing values are preserved in the DB so re-enabling restores everything.
- **`forcedTheme="light"`** in `app/layout.tsx`'s ThemeProvider — overrides any stored localStorage theme. The dark palette in `globals.css` is intentional dead code retained for a future toggle.

## Dev commands

```bash
npm run dev          # Next dev
npm run build        # Production build
npm run lint         # ESLint
npm run db:seed      # Seed realistic Indian retail data
npm run db:reset     # Wipe + reseed
```

## Out-of-scope items (currently deferred)

Listed in `phase_roadmap.md` memory. Most notable: image upload backend, CSV import, real PDF/`.xlsx` exports, thermal-printer ESC/POS, UPI QR rendering, purchase returns, branch transfers, WhatsApp share, Malayalam i18n.
