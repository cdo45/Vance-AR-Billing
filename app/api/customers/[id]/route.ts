import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await initDb();
  const sql = getSql();
  const id = parseInt(params.id);

  const custRows = await sql`SELECT * FROM customers WHERE id = ${id}`;
  if (!custRows.length) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const jobRows = await sql`
    SELECT j.*,
           COALESCE(SUM(be.week_total), 0)::numeric AS total_billed
    FROM jobs j
    LEFT JOIN billing_entries be ON be.rj_number = j.rj_number
    WHERE j.customer_id = ${id}
    GROUP BY j.id
    ORDER BY j.rj_number
  `;

  return NextResponse.json({ customer: custRows[0], jobs: jobRows });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await initDb();
  const sql = getSql();
  const id = parseInt(params.id);
  const body = await req.json();

  const rows = await sql`
    UPDATE customers
    SET company_name  = ${body.company_name  ?? ""},
        contact_name  = ${body.contact_name  ?? ""},
        contact_email = ${body.contact_email ?? ""},
        contact_phone = ${body.contact_phone ?? ""},
        address       = ${body.address       ?? ""},
        notes         = ${body.notes         ?? ""},
        updated_at    = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
