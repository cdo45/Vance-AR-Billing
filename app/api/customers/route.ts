import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb, Customer } from "@/lib/db";

export async function GET() {
  await initDb();
  const sql = getSql();

  const rows = await sql`
    SELECT
      c.*,
      COUNT(DISTINCT j.id)::int        AS job_count,
      COALESCE(SUM(be.week_total), 0)::numeric AS total_billed_ytd,
      MAX(be.week_start)               AS last_entry_date
    FROM customers c
    LEFT JOIN jobs j ON j.customer_id = c.id
    LEFT JOIN billing_entries be
      ON  be.company_name = c.company_name
      AND be.week_start >= TO_CHAR(DATE_TRUNC('year', NOW()), 'YYYY-MM-DD')
    GROUP BY c.id
    ORDER BY c.company_name
  `;

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { company_name, contact_name, contact_email, contact_phone, address, notes } = body;

  if (!company_name?.trim()) {
    return NextResponse.json({ error: "company_name is required" }, { status: 400 });
  }

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

  return NextResponse.json(rows[0], { status: 201 });
}
