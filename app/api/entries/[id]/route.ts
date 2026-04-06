import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await initDb();
  const sql = getSql();

  const body = await req.json();

  // Status-only update (cycle button — no reason required)
  if ("status" in body && !("sun" in body)) {
    const { status, edited_by } = body;
    const existing = await sql`SELECT status FROM billing_entries WHERE id = ${id}`;
    if (!existing.length) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    const oldStatus = String((existing[0] as { status: string }).status ?? "pending");

    await sql`UPDATE billing_entries SET status = ${status} WHERE id = ${id}`;
    await sql`
      INSERT INTO audit_log (entry_id, field_changed, old_value, new_value, reason, edited_by)
      VALUES (${id}, 'status', ${oldStatus}, ${status}, 'Status updated via dispatch grid', ${edited_by || "Jill"})
    `;
    return NextResponse.json({ ok: true });
  }

  // Full edit (requires reason)
  const {
    sun, mon, tue, wed, thu, fri, sat,
    invoice_number, notes, work_description, prelim_date,
    reason, edited_by,
  } = body;

  if (!reason?.trim()) {
    return NextResponse.json({ error: "Reason for edit is required." }, { status: 400 });
  }

  const existing = await sql`SELECT * FROM billing_entries WHERE id = ${id}`;
  if (!existing.length) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const old = existing[0] as Record<string, unknown>;
  const week_total = [sun, mon, tue, wed, thu, fri, sat].reduce(
    (a: number, b: unknown) => a + Number(b || 0), 0
  );

  await sql`
    UPDATE billing_entries SET
      sun              = ${Number(sun || 0)},
      mon              = ${Number(mon || 0)},
      tue              = ${Number(tue || 0)},
      wed              = ${Number(wed || 0)},
      thu              = ${Number(thu || 0)},
      fri              = ${Number(fri || 0)},
      sat              = ${Number(sat || 0)},
      week_total       = ${week_total},
      invoice_number   = ${invoice_number || ""},
      notes            = ${notes || ""},
      work_description = ${work_description || ""},
      prelim_date      = ${prelim_date || null}
    WHERE id = ${id}
  `;

  const fields = ["sun","mon","tue","wed","thu","fri","sat","invoice_number","notes","work_description","prelim_date"] as const;
  const newVals: Record<string, unknown> = {
    sun: Number(sun||0), mon: Number(mon||0), tue: Number(tue||0),
    wed: Number(wed||0), thu: Number(thu||0), fri: Number(fri||0),
    sat: Number(sat||0), invoice_number: invoice_number||"",
    notes: notes||"", work_description: work_description||"",
    prelim_date: prelim_date||null,
  };

  for (const field of fields) {
    const oldVal = String(old[field] ?? "");
    const newVal = String(newVals[field] ?? "");
    if (oldVal !== newVal) {
      await sql`
        INSERT INTO audit_log (entry_id, field_changed, old_value, new_value, reason, edited_by)
        VALUES (${id}, ${field}, ${oldVal}, ${newVal}, ${reason}, ${edited_by || "Jill"})
      `;
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await initDb();
  const sql = getSql();
  await sql`DELETE FROM billing_entries WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
