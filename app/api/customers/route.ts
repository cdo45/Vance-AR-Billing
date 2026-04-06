import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb, Customer } from "@/lib/db";

export async function GET() {
  try {
    await initDb();
    const sql = getSql();

    const rows = await sql`
      SELECT
        c.*,
        COUNT(DISTINCT j.id)::int               AS job_count,
        COALESCE(SUM(be.week_total), 0)::numeric AS total_billed_ytd,
        MAX(be.week_start)                       AS last_entry_date
      FROM customers c
      LEFT JOIN jobs j ON j.customer_id = c.id
      LEFT JOIN billing_entries be
        ON  be.company_name = c.company_name
        AND be.week_start >= TO_CHAR(DATE_TRUNC('year', NOW()), 'YYYY-MM-DD')
      GROUP BY c.id
      ORDER BY c.company_name
    `;

    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[customers GET] Failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company_name, contact_name, contact_email, contact_phone, address, notes } = body;

    if (!company_name?.trim()) {
      return NextResponse.json({ error: "company_name is required" }, { status: 400 });
    }

    console.log("[customers POST] Saving customer:", company_name.trim());

    await initDb();
    const sql = getSql();

    const rows = await sql`
      INSERT INTO customers
        (company_name, contact_name, contact_email, contact_phone, address, notes)
      VALUES
        (${company_name.trim()},
         ${(contact_name  || "").trim()},
         ${(contact_email || "").trim()},
         ${(contact_phone || "").trim()},
         ${(address       || "").trim()},
         ${(notes         || "").trim()})
      ON CONFLICT (company_name) DO UPDATE
        SET contact_name  = EXCLUDED.contact_name,
            contact_email = EXCLUDED.contact_email,
            contact_phone = EXCLUDED.contact_phone,
            address       = EXCLUDED.address,
            notes         = EXCLUDED.notes,
            updated_at    = NOW()
      RETURNING *
    ` as Customer[];

    console.log("[customers POST] Saved customer id:", rows[0]?.id);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[customers POST] Failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
