import { NextResponse } from "next/server";
import { getSql, initDb, forceSeedJobs } from "@/lib/db";

export async function GET() {
  try {
    await initDb();
    const sql = getSql();

    const [billing, customers, jobs, customJobs] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM billing_entries`,
      sql`SELECT COUNT(*)::int AS n FROM customers`,
      sql`SELECT COUNT(*)::int AS n FROM jobs`,
      sql`SELECT COUNT(*)::int AS n FROM custom_jobs`,
    ]);

    const counts = {
      billing_entries: (billing[0] as { n: number }).n,
      customers:       (customers[0] as { n: number }).n,
      jobs:            (jobs[0] as { n: number }).n,
      custom_jobs:     (customJobs[0] as { n: number }).n,
    };

    console.log("[debug] Table counts:", counts);
    return NextResponse.json({ status: "ok", counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[debug] Failed:", message);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST() {
  try {
    await initDb();
    const sql = getSql();

    const before = await sql`SELECT COUNT(*)::int AS n FROM jobs`;
    const beforeCount = (before[0] as { n: number }).n;

    await forceSeedJobs();

    const after = await sql`SELECT COUNT(*)::int AS n FROM jobs`;
    const afterCount = (after[0] as { n: number }).n;

    console.log(`[debug/seed] before=${beforeCount} after=${afterCount}`);
    return NextResponse.json({ status: "ok", before: beforeCount, after: afterCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[debug/seed] Failed:", message);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
