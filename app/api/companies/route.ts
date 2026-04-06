import { NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET() {
  try {
    await initDb();
    const sql = getSql();

    // Pull distinct company names from both billing_entries and custom_jobs
    const rows = await sql`
      SELECT DISTINCT company_name
      FROM (
        SELECT company_name FROM billing_entries WHERE company_name <> ''
        UNION
        SELECT company_name FROM custom_jobs   WHERE company_name <> ''
      ) combined
      ORDER BY company_name ASC
    `;

    const names = rows.map((r) => (r as { company_name: string }).company_name);
    return NextResponse.json(names);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[companies] Failed to fetch company names:", message);
    return NextResponse.json([], { status: 200 }); // graceful fallback
  }
}
