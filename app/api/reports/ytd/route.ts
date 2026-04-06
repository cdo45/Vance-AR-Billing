import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  if (!year) return NextResponse.json({ error: "year param required" }, { status: 400 });

  const y = parseInt(year, 10);
  if (isNaN(y)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });

  const firstDay = `${y}-01-01`;
  const lastDay  = `${y}-12-31`;

  await initDb();
  const sql = getSql();

  const rows = await sql`
    SELECT id, rj_number, company_name, week_start,
           sun, mon, tue, wed, thu, fri, sat, week_total
    FROM billing_entries
    WHERE week_start >= ${firstDay} AND week_start <= ${lastDay}
    ORDER BY week_start, company_name
  `;

  // Count active jobs
  const activeJobs = await sql`
    SELECT COUNT(*)::int AS n FROM jobs WHERE status = 'active'
  `;

  return NextResponse.json({
    entries: rows,
    activeJobs: (activeJobs[0] as { n: number }).n,
  });
}
