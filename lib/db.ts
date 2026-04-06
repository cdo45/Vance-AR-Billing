import { neon } from "@neondatabase/serverless";

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

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  return neon(url);
}

export async function initDb() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS billing_entries (
      id             SERIAL PRIMARY KEY,
      rj_number      TEXT    NOT NULL,
      company_name   TEXT    NOT NULL,
      job_description TEXT   NOT NULL DEFAULT '',
      week_start     TEXT    NOT NULL,
      sun            NUMERIC NOT NULL DEFAULT 0,
      mon            NUMERIC NOT NULL DEFAULT 0,
      tue            NUMERIC NOT NULL DEFAULT 0,
      wed            NUMERIC NOT NULL DEFAULT 0,
      thu            NUMERIC NOT NULL DEFAULT 0,
      fri            NUMERIC NOT NULL DEFAULT 0,
      sat            NUMERIC NOT NULL DEFAULT 0,
      week_total     NUMERIC NOT NULL DEFAULT 0,
      invoice_number TEXT    NOT NULL DEFAULT '',
      notes          TEXT    NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_week_start ON billing_entries(week_start)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rj_number  ON billing_entries(rj_number)`;
  await sql`
    CREATE TABLE IF NOT EXISTS custom_jobs (
      id             SERIAL PRIMARY KEY,
      rj_number      TEXT    UNIQUE NOT NULL,
      company_name   TEXT    NOT NULL,
      job_description TEXT   NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export interface JobRecord {
  rj_number: string;
  company_name: string;
  job_description: string;
}
