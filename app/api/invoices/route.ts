import { NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET() {
  try {
    await initDb();
    const sql = getSql();
    const rows = await sql`
      SELECT id, rj_number, company_name, week_start, invoice_number,
             sun, mon, tue, wed, thu, fri, sat, week_total,
             work_description, prelim_date, notes, status, created_at
      FROM billing_entries
      ORDER BY week_start DESC, invoice_number, company_name
    `;
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
