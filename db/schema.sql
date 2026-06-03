-- RETAILO local SQLite schema. Single-file DB at SQLITE_DB_PATH.
-- All ids are UUID strings (crypto.randomUUID()) so they round-trip with cloud Mongo.
-- updated_at + dirty drive last-write-wins sync; see lib/sync/*.

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
  images TEXT NOT NULL DEFAULT '[]',          -- JSON array of urls
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

-- Outbox: local writes that need to be pushed to cloud Mongo.
CREATE TABLE IF NOT EXISTS sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  op TEXT NOT NULL,                           -- 'upsert' | 'delete'
  payload TEXT NOT NULL,                      -- JSON document
  enqueued_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_collection ON sync_outbox(collection);

-- Per-collection high-water mark of the most recent cloud updated_at we've
-- pulled down. Drives the pull side of last-write-wins sync.
CREATE TABLE IF NOT EXISTS sync_pull_state (
  collection TEXT PRIMARY KEY,
  last_pulled_at INTEGER NOT NULL DEFAULT 0
);
