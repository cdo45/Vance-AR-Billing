import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await initDb();
  const sql = getSql();

  const rows = await sql`
    SELECT * FROM audit_log
    WHERE entry_id = ${id}
    ORDER BY edited_at DESC
  `;

  return NextResponse.json(rows);
}
