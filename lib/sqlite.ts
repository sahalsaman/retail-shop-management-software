import "server-only";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

// SQLITE_DB_PATH is set by Electron's main process to %APPDATA%/RETAILO/rsms.db.
// In dev (next dev outside Electron) we fall back to .data/rsms.db at repo root.
function dbPath(): string {
  if (process.env.SQLITE_DB_PATH) return process.env.SQLITE_DB_PATH;
  const fallback = path.join(process.cwd(), ".data", "rsms.db");
  fs.mkdirSync(path.dirname(fallback), { recursive: true });
  return fallback;
}

// Inlined so Next.js NFT tracing doesn't have to figure out a dynamic
// schema.sql path — that's what blew up the standalone bundle size before.
// The DDL is idempotent (IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gstin TEXT,
  state_code TEXT,
  gst_enabled INTEGER NOT NULL DEFAULT 1,
  printer_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  branch_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER,
  updated_at INTEGER NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_branches_shop ON branches(shop_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_categories_shop ON categories(shop_id);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_brands_shop ON brands(shop_id);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  category_id TEXT,
  brand_id TEXT,
  hsn_code TEXT,
  gst_rate REAL NOT NULL DEFAULT 0,
  purchase_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  mrp REAL,
  unit TEXT NOT NULL DEFAULT 'PCS',
  images TEXT NOT NULL DEFAULT '[]',
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  has_expiry INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  dirty INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_shop_sku ON products(shop_id, sku) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(shop_id, name);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  batches TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory ON inventory(shop_id, branch_id, product_id);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  enqueued_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_collection ON sync_outbox(collection);

CREATE TABLE IF NOT EXISTS sync_pull_state (
  collection TEXT PRIMARY KEY,
  last_pulled_at INTEGER NOT NULL DEFAULT 0
);

-- Tiny key/value store for active session context (active_user_id, active_shop_id, ...).
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

// Tables that hold tenant-scoped data. Shops table is keyed by id directly;
// the rest carry a shop_id column.
const TENANT_TABLES_WITH_SHOP_COL = ["branches", "categories", "brands", "products", "inventory"];

// Remove any rows that belong to a different shop than the one currently
// logged in. Called on every login so the local DB only ever contains the
// active tenant's data, even if a previous session synced something else.
export function pruneOtherShops(activeShopId: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM shops WHERE id != ?`).run(activeShopId);
    for (const t of TENANT_TABLES_WITH_SHOP_COL) {
      db.prepare(`DELETE FROM ${t} WHERE shop_id != ?`).run(activeShopId);
    }
    db.exec(`DELETE FROM sync_pull_state`);
    db.exec(`DELETE FROM sync_outbox`);
  });
  tx();
}

type Cache = { db: Database.Database | null };
const globalForSqlite = globalThis as unknown as { _rsmsSqlite?: Cache };
const cache: Cache = globalForSqlite._rsmsSqlite ?? { db: null };
if (!globalForSqlite._rsmsSqlite) globalForSqlite._rsmsSqlite = cache;

export function getDb(): Database.Database {
  if (cache.db) return cache.db;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Schema is CREATE TABLE IF NOT EXISTS throughout — safe to run every time
  // a new connection opens. This also picks up any new tables added later
  // without forcing a full DB wipe.
  db.exec(SCHEMA_SQL);
  cache.db = db;
  return db;
}

export function nowMs(): number {
  return Date.now();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function getMeta(key: string): string | null {
  const row = getDb()
    .prepare(`SELECT value FROM app_meta WHERE key = ?`)
    .get(key) as { value: string | null } | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string | null): void {
  if (value === null) {
    getDb().prepare(`DELETE FROM app_meta WHERE key = ?`).run(key);
    return;
  }
  getDb()
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}
