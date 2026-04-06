import { NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export async function GET() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error("[health] DATABASE_URL is not set — database will not work");
    return NextResponse.json(
      { status: "error", message: "DATABASE_URL environment variable is not set" },
      { status: 500 }
    );
  }

  try {
    await initDb();
    const sql = getSql();
    await sql`SELECT 1`;
    console.log("[health] Database connection OK");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[health] Database connection failed:", message);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
