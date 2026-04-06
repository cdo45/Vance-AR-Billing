import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { rj: string } }
) {
  await initDb();
  const sql = getSql();
  const rj = decodeURIComponent(params.rj);

  const jobRows = await sql`
    SELECT j.*,
           c.contact_name, c.contact_email, c.contact_phone
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    WHERE j.rj_number = ${rj}
  `;
  if (!jobRows.length) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const monthly = await sql`
    SELECT
      TO_CHAR(week_start::date, 'YYYY-MM')  AS month,
      SUM(week_total)::numeric              AS total,
      COUNT(*)::int                         AS entry_count
    FROM billing_entries
    WHERE rj_number = ${rj}
    GROUP BY TO_CHAR(week_start::date, 'YYYY-MM')
    ORDER BY month DESC
  `;

  return NextResponse.json({ job: jobRows[0], monthly });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { rj: string } }
) {
  await initDb();
  const sql = getSql();
  const rj = decodeURIComponent(params.rj);
  const body = await req.json();

  const rows = await sql`
    UPDATE jobs
    SET job_description   = ${body.job_description   ?? ""},
        company_name      = ${body.company_name      ?? ""},
        location          = ${body.location          ?? ""},
        contract_amount   = ${body.contract_amount   ?? null},
        start_date        = ${body.start_date        ?? null},
        status            = ${body.status            ?? "active"},
        certified_payroll = ${body.certified_payroll ?? false},
        notes             = ${body.notes             ?? ""},
        updated_at        = NOW()
    WHERE rj_number = ${rj}
    RETURNING *
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
