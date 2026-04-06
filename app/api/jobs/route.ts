import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb, JobRecord } from "@/lib/db";
import path from "path";
import fs from "fs";

// ── GET: return merged static jobs.json + custom_jobs table ──────────────────
export async function GET() {
  // 1. Load static jobs.json safely
  let staticJobs: JobRecord[] = [];
  try {
    const filePath = path.join(process.cwd(), "data", "jobs.json");
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) {
      console.warn("[jobs] data/jobs.json is empty — using empty list");
    } else {
      staticJobs = JSON.parse(raw);
      console.log(`[jobs] Loaded ${staticJobs.length} jobs from jobs.json`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[jobs] Could not load data/jobs.json: ${msg} — using empty list`);
    staticJobs = [];
  }

  // 2. Load custom jobs from database
  let customJobs: JobRecord[] = [];
  try {
    await initDb();
    const sql = getSql();
    customJobs = (await sql`
      SELECT rj_number, company_name, COALESCE(job_description, '') AS job_description
      FROM custom_jobs
      ORDER BY created_at DESC
    `) as JobRecord[];
    console.log(`[jobs] Loaded ${customJobs.length} custom jobs from database`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[jobs] Could not load custom_jobs from database: ${msg}`);
    customJobs = [];
  }

  // 3. Merge: custom jobs take precedence over static ones with same rj_number
  const seen = new Set<string>();
  const merged: JobRecord[] = [];

  for (const j of customJobs) {
    seen.add(j.rj_number.toUpperCase());
    merged.push(j);
  }
  for (const j of staticJobs) {
    if (!seen.has(j.rj_number.toUpperCase())) {
      merged.push(j);
    }
  }

  // Sort by rj_number
  merged.sort((a, b) => a.rj_number.localeCompare(b.rj_number, undefined, { numeric: true }));

  return NextResponse.json(merged);
}

// ── POST: save a new custom job ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rj_number, company_name, job_description } = body;

  if (!rj_number?.trim() || !company_name?.trim()) {
    return NextResponse.json(
      { error: "rj_number and company_name are required" },
      { status: 400 }
    );
  }

  await initDb();
  const sql = getSql();

  // Upsert — if RJ# already exists, update company/description
  const rows = await sql`
    INSERT INTO custom_jobs (rj_number, company_name, job_description)
    VALUES (${rj_number.trim()}, ${company_name.trim()}, ${(job_description || "").trim()})
    ON CONFLICT (rj_number) DO UPDATE
      SET company_name    = EXCLUDED.company_name,
          job_description = EXCLUDED.job_description
    RETURNING *
  `;

  return NextResponse.json(rows[0], { status: 201 });
}
