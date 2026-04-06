import { neon } from "@neondatabase/serverless";
import path from "path";
import fs from "fs";

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  work_description: string;
  prelim_date: string | null;
  customer_id: number | null;
  created_at: string;
}

export interface JobRecord {
  rj_number: string;
  company_name: string;
  job_description: string;
  customer_id?: number | null;
}

export interface Job {
  id: number;
  rj_number: string;
  job_description: string;
  company_name: string;
  customer_id: number | null;
  location: string;
  contract_amount: number | null;
  start_date: string | null;
  status: string;
  certified_payroll: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Connection ───────────────────────────────────────────────────────────────

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  return neon(url);
}

// ─── initDb ───────────────────────────────────────────────────────────────────

let _initialized = false;

export async function initDb() {
  if (_initialized) return;
  const sql = getSql();

  // ── billing_entries ─────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS billing_entries (
      id               SERIAL PRIMARY KEY,
      rj_number        TEXT    NOT NULL,
      company_name     TEXT    NOT NULL,
      job_description  TEXT    NOT NULL DEFAULT '',
      week_start       TEXT    NOT NULL,
      sun              NUMERIC NOT NULL DEFAULT 0,
      mon              NUMERIC NOT NULL DEFAULT 0,
      tue              NUMERIC NOT NULL DEFAULT 0,
      wed              NUMERIC NOT NULL DEFAULT 0,
      thu              NUMERIC NOT NULL DEFAULT 0,
      fri              NUMERIC NOT NULL DEFAULT 0,
      sat              NUMERIC NOT NULL DEFAULT 0,
      week_total       NUMERIC NOT NULL DEFAULT 0,
      invoice_number   TEXT    NOT NULL DEFAULT '',
      notes            TEXT    NOT NULL DEFAULT '',
      work_description TEXT    NOT NULL DEFAULT '',
      prelim_date      DATE,
      customer_id      INTEGER,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE billing_entries ADD COLUMN IF NOT EXISTS work_description TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE billing_entries ADD COLUMN IF NOT EXISTS prelim_date DATE`;
  await sql`ALTER TABLE billing_entries ADD COLUMN IF NOT EXISTS customer_id INTEGER`;
  await sql`CREATE INDEX IF NOT EXISTS idx_week_start ON billing_entries(week_start)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rj_number  ON billing_entries(rj_number)`;

  // ── custom_jobs (legacy, kept for backwards compat) ─────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS custom_jobs (
      id              SERIAL PRIMARY KEY,
      rj_number       TEXT    UNIQUE NOT NULL,
      company_name    TEXT    NOT NULL,
      job_description TEXT    NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── customers ───────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id            SERIAL PRIMARY KEY,
      company_name  TEXT        NOT NULL UNIQUE,
      contact_name  TEXT        NOT NULL DEFAULT '',
      contact_email TEXT        NOT NULL DEFAULT '',
      contact_phone TEXT        NOT NULL DEFAULT '',
      address       TEXT        NOT NULL DEFAULT '',
      notes         TEXT        NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── jobs ────────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id                SERIAL PRIMARY KEY,
      rj_number         TEXT    NOT NULL UNIQUE,
      job_description   TEXT    NOT NULL DEFAULT '',
      company_name      TEXT    NOT NULL,
      customer_id       INTEGER REFERENCES customers(id),
      location          TEXT    NOT NULL DEFAULT '',
      contract_amount   REAL,
      start_date        DATE,
      status            TEXT    NOT NULL DEFAULT 'active',
      certified_payroll BOOLEAN NOT NULL DEFAULT false,
      notes             TEXT    NOT NULL DEFAULT '',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Seed from jobs.json if tables are empty ─────────────────────────────────
  await seedFromJobsJson();

  _initialized = true;
}

// ─── Seeder ───────────────────────────────────────────────────────────────────

async function seedFromJobsJson() {
  const sql = getSql();
  const countRows = await sql`SELECT COUNT(*)::int AS n FROM jobs`;
  const count = (countRows[0] as { n: number }).n;
  if (count > 0) return;

  let staticJobs: JobRecord[] = [];
  try {
    const filePath = path.join(process.cwd(), "data", "jobs.json");
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (raw) staticJobs = JSON.parse(raw);
  } catch {
    console.warn("[db] Could not load jobs.json for seeding — skipping");
    return;
  }
  if (!staticJobs.length) return;

  console.log(`[db] Seeding ${staticJobs.length} jobs + customers from jobs.json…`);

  // Seed customers (distinct company names) in chunks of 500
  const seen = new Set<string>();
  const distinctCompanies: string[] = [];
  for (const j of staticJobs) {
    if (j.company_name && !seen.has(j.company_name)) {
      seen.add(j.company_name);
      distinctCompanies.push(j.company_name);
    }
  }
  const CCHUNK = 500;
  for (let i = 0; i < distinctCompanies.length; i += CCHUNK) {
    const chunk = distinctCompanies.slice(i, i + CCHUNK);
    await sql`
      INSERT INTO customers (company_name)
      SELECT unnest(${chunk}::text[])
      ON CONFLICT (company_name) DO NOTHING
    `;
  }

  // Seed jobs in chunks of 500
  const JCHUNK = 500;
  for (let i = 0; i < staticJobs.length; i += JCHUNK) {
    const slice = staticJobs.slice(i, i + JCHUNK);
    const rjNums    = slice.map(j => j.rj_number);
    const descs     = slice.map(j => j.job_description || "");
    const companies = slice.map(j => j.company_name);
    await sql`
      INSERT INTO jobs (rj_number, job_description, company_name)
      SELECT t.rj, t.desc, t.co
      FROM unnest(${rjNums}::text[], ${descs}::text[], ${companies}::text[])
        AS t(rj, desc, co)
      ON CONFLICT (rj_number) DO NOTHING
    `;
  }

  // Link jobs → customers
  await sql`
    UPDATE jobs j
    SET customer_id = c.id
    FROM customers c
    WHERE j.company_name = c.company_name
      AND j.customer_id IS NULL
  `;

  console.log("[db] Seeding complete");
}
