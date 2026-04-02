import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "vance.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS billing_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      rj_number   TEXT    NOT NULL,
      company_name TEXT   NOT NULL,
      job_description TEXT NOT NULL DEFAULT '',
      week_start  TEXT    NOT NULL,   -- ISO date: YYYY-MM-DD (always a Sunday)
      sun         REAL    NOT NULL DEFAULT 0,
      mon         REAL    NOT NULL DEFAULT 0,
      tue         REAL    NOT NULL DEFAULT 0,
      wed         REAL    NOT NULL DEFAULT 0,
      thu         REAL    NOT NULL DEFAULT 0,
      fri         REAL    NOT NULL DEFAULT 0,
      sat         REAL    NOT NULL DEFAULT 0,
      week_total  REAL    NOT NULL DEFAULT 0,
      invoice_number TEXT NOT NULL DEFAULT '',
      notes       TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_week_start ON billing_entries(week_start);
    CREATE INDEX IF NOT EXISTS idx_rj_number  ON billing_entries(rj_number);
  `);

  return _db;
}

export interface BillingEntry {
  id: number;
  rj_number: string;
  company_name: string;
  job_description: string;
  week_start: string;
  sun: number;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  week_total: number;
  invoice_number: string;
  notes: string;
  created_at: string;
}
