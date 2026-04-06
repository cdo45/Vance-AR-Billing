import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year");
  const month = searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json({ error: "year and month params required" }, { status: 400 });
  }

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  // First and last day of the month
  const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay  = new Date(y, m, 0).toISOString().slice(0, 10); // last day of month

  await initDb();
  const sql = getSql();

  const rows = await sql`
    SELECT id, rj_number, company_name, work_description, invoice_number, week_start,
           sun, mon, tue, wed, thu, fri, sat, week_total
    FROM billing_entries
    WHERE week_start >= ${firstDay} AND week_start <= ${lastDay}
    ORDER BY week_start, company_name, rj_number
  `;

  return NextResponse.json(rows);
}
