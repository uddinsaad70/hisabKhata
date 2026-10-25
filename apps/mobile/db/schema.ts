/**
 * Local SQLite V1 Schema DDL and Table/Index Names.
 * Strictly follows Specification Section 6.4.
 */

export const CORE_TABLE_NAMES = [
  "businesses",
  "customers",
  "customer_entries",
  "cashbook_entries",
  "sync_state",
] as const;

export const CORE_INDEX_NAMES = [
  "idx_customers_biz_updated",
  "idx_cust_entries_ledger",
  "idx_cashbook_biz_date",
  "idx_unsynced_businesses",
  "idx_unsynced_customers",
  "idx_unsynced_cust_entries",
  "idx_unsynced_cashbook_entries",
] as const;

export const INITIAL_PRAGMAS_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
`;

export const INITIAL_V1_SCHEMA_SQL = `
-- 1. Businesses Table
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT' CHECK (currency IN ('BDT', 'INR')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0
);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_initials TEXT NOT NULL,
  net_balance REAL NOT NULL DEFAULT 0,
  last_transaction_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 3. Customer Ledger Entries Table
CREATE TABLE IF NOT EXISTS customer_entries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('GAVE', 'GOT')),
  amount REAL NOT NULL CHECK (amount > 0),
  details TEXT,
  entry_date TEXT NOT NULL,
  entry_time TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 4. Cashbook Entries Table
CREATE TABLE IF NOT EXISTS cashbook_entries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('OUT', 'IN')),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'ONLINE')),
  amount REAL NOT NULL CHECK (amount > 0),
  details TEXT,
  entry_date TEXT NOT NULL,
  entry_time TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- 5. Sync Metadata Table (Local Only, tracks 'GLOBAL' cursor state)
CREATE TABLE IF NOT EXISTS sync_state (
  business_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  last_pulled_cursor TEXT,
  last_pushed_at INTEGER NOT NULL DEFAULT 0
);

-- 6. Local Performance Indexes
CREATE INDEX IF NOT EXISTS idx_customers_biz_updated
  ON customers(business_id, is_deleted, last_transaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_cust_entries_ledger
  ON customer_entries(business_id, customer_id, is_deleted, entry_date ASC, timestamp ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_cashbook_biz_date
  ON cashbook_entries(business_id, is_deleted, entry_date ASC, payment_mode, timestamp ASC);

CREATE INDEX IF NOT EXISTS idx_unsynced_businesses
  ON businesses(is_synced) WHERE is_synced = 0;

CREATE INDEX IF NOT EXISTS idx_unsynced_customers
  ON customers(is_synced) WHERE is_synced = 0;

CREATE INDEX IF NOT EXISTS idx_unsynced_cust_entries
  ON customer_entries(is_synced) WHERE is_synced = 0;

CREATE INDEX IF NOT EXISTS idx_unsynced_cashbook_entries
  ON cashbook_entries(is_synced) WHERE is_synced = 0;
`;
