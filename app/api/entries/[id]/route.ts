import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

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
