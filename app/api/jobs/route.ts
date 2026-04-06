import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb, JobRecord } from "@/lib/db";
import path from "path";
import fs from "fs";

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
// Without params  → lightweight JobRecord[] for the entry form dropdown
// With ?stats=1   → full job objects with aggregated billing totals
// Accepts ?search= and ?status= filters (implies stats mode)

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") || "";
  const status = req.nextUrl.searchParams.get("status") || "";
  const stats  = req.nextUrl.searchParams.get("stats")  === "1" || !!(search || status);

  try {
    await initDb();
    const sql = getSql();

    if (stats) {
      // Full query with aggregated billing for jobs page
      const searchPat = `%${search}%`;
      const rows = await sql`
        SELECT
          j.id, j.rj_number, j.job_description, j.company_name,
          j.customer_id, j.location, j.contract_amount, j.start_date,
          j.status, j.certified_payroll, j.notes, j.created_at, j.updated_at,
          COALESCE(SUM(be.week_total), 0)::numeric AS total_billed,
          MAX(be.week_start)                        AS last_entry_date
        FROM jobs j
        LEFT JOIN billing_entries be ON be.rj_number = j.rj_number
        WHERE (${search} = '' OR
               j.rj_number      ILIKE ${searchPat} OR
               j.company_name   ILIKE ${searchPat} OR
               j.job_description ILIKE ${searchPat})
          AND (${status} = '' OR j.status = ${status})
        GROUP BY j.id
        ORDER BY j.rj_number
      `;
      return NextResponse.json(rows);
    }

    // Lightweight dropdown query
    const rows = await sql`
      SELECT rj_number, company_name,
             COALESCE(job_description, '') AS job_description,
             customer_id
      FROM jobs
      ORDER BY rj_number
    ` as JobRecord[];

    // Fall back to legacy if jobs table is still empty
    if (rows.length === 0) {
      return legacyFallback();
    }

    return NextResponse.json(rows);
  } catch {
    return legacyFallback();
  }
}

async function legacyFallback(): Promise<NextResponse> {
  let staticJobs: JobRecord[] = [];
  try {
    const filePath = path.join(process.cwd(), "data", "jobs.json");
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (raw) staticJobs = JSON.parse(raw);
    console.log(`[jobs] Loaded ${staticJobs.length} jobs from jobs.json (fallback)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[jobs] Could not load data/jobs.json: ${msg} — using empty list`);
  }

  let customJobs: JobRecord[] = [];
  try {
    const sql = getSql();
    customJobs = (await sql`
      SELECT rj_number, company_name, COALESCE(job_description, '') AS job_description
      FROM custom_jobs ORDER BY created_at DESC
    `) as JobRecord[];
    console.log(`[jobs] Loaded ${customJobs.length} custom jobs from database (fallback)`);
  } catch { /* ignore */ }

  const seen = new Set<string>();
  const merged: JobRecord[] = [];
  for (const j of customJobs) { seen.add(j.rj_number.toUpperCase()); merged.push(j); }
  for (const j of staticJobs) { if (!seen.has(j.rj_number.toUpperCase())) merged.push(j); }
  merged.sort((a, b) => a.rj_number.localeCompare(b.rj_number, undefined, { numeric: true }));
  return NextResponse.json(merged);
}

// ── POST /api/jobs ────────────────────────────────────────────────────────────
// Creates/updates a job and upserts the customer

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    rj_number, company_name, job_description,
    location, contract_amount, start_date,
    status, certified_payroll, notes,
  } = body;

  if (!rj_number?.trim() || !company_name?.trim()) {
    return NextResponse.json(
      { error: "rj_number and company_name are required" },
      { status: 400 }
    );
  }

  await initDb();
  const sql = getSql();

  // Upsert customer
  await sql`
    INSERT INTO customers (company_name)
    VALUES (${company_name.trim()})
    ON CONFLICT (company_name) DO NOTHING
  `;
  const custRows = await sql`
    SELECT id FROM customers WHERE company_name = ${company_name.trim()}
  `;
  const customer_id = (custRows[0] as { id: number })?.id ?? null;

  // Upsert into jobs table
  const rows = await sql`
    INSERT INTO jobs
      (rj_number, company_name, job_description, customer_id,
       location, contract_amount, start_date, status, certified_payroll, notes)
    VALUES
      (${rj_number.trim()}, ${company_name.trim()}, ${(job_description || "").trim()},
       ${customer_id}, ${(location || "").trim()}, ${contract_amount ?? null},
       ${start_date || null}, ${status || "active"}, ${certified_payroll ?? false},
       ${(notes || "").trim()})
    ON CONFLICT (rj_number) DO UPDATE
      SET company_name      = EXCLUDED.company_name,
          job_description   = EXCLUDED.job_description,
          customer_id       = EXCLUDED.customer_id,
          location          = EXCLUDED.location,
          contract_amount   = EXCLUDED.contract_amount,
          start_date        = EXCLUDED.start_date,
          status            = EXCLUDED.status,
          certified_payroll = EXCLUDED.certified_payroll,
          notes             = EXCLUDED.notes,
          updated_at        = NOW()
    RETURNING *
  `;

  // Also keep custom_jobs in sync for legacy fallback
  await sql`
    INSERT INTO custom_jobs (rj_number, company_name, job_description)
    VALUES (${rj_number.trim()}, ${company_name.trim()}, ${(job_description || "").trim()})
    ON CONFLICT (rj_number) DO UPDATE
      SET company_name    = EXCLUDED.company_name,
          job_description = EXCLUDED.job_description
  `;

  return NextResponse.json(rows[0], { status: 201 });
}
