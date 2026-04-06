import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week");
  if (!week) return NextResponse.json({ error: "week param required (YYYY-MM-DD)" }, { status: 400 });

  await initDb();
  const sql = getSql();

  const rows = await sql`
    SELECT id, rj_number, company_name, work_description, invoice_number,
           sun, mon, tue, wed, thu, fri, sat, week_total, notes, prelim_date
    FROM billing_entries
    WHERE week_start = ${week}
    ORDER BY company_name, rj_number
  `;

  return NextResponse.json(rows);
}
