import { NextRequest, NextResponse } from "next/server";
import { getDb, BillingEntry } from "@/lib/db";

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "week param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM billing_entries WHERE week_start = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(week) as BillingEntry[];

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rj_number, company_name, job_description, week_start, sun, mon, tue, wed, thu, fri, sat, invoice_number, notes } = body;

  if (!rj_number || !company_name || !week_start) {
    return NextResponse.json({ error: "rj_number, company_name, and week_start are required" }, { status: 400 });
  }

  const s = Number(sun || 0);
  const m = Number(mon || 0);
  const t = Number(tue || 0);
  const w = Number(wed || 0);
  const th = Number(thu || 0);
  const f = Number(fri || 0);
  const sa = Number(sat || 0);
  const week_total = s + m + t + w + th + f + sa;

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO billing_entries
        (rj_number, company_name, job_description, week_start, sun, mon, tue, wed, thu, fri, sat, week_total, invoice_number, notes)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      rj_number,
      company_name,
      job_description || "",
      week_start,
      s, m, t, w, th, f, sa,
      week_total,
      invoice_number || "",
      notes || ""
    );

  const created = db
    .prepare("SELECT * FROM billing_entries WHERE id = ?")
    .get(result.lastInsertRowid) as BillingEntry;

  return NextResponse.json(created, { status: 201 });
}
