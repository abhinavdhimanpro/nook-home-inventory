import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOME_ID = "primary-home";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  return neon(databaseUrl);
}

async function ensureTable(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS nook_homes (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function GET() {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ mode: "local", message: "DATABASE_URL is not configured" }, { status: 503 });
  }
  await ensureTable(sql);
  const rows = await sql`SELECT data, updated_at FROM nook_homes WHERE id = ${HOME_ID}`;
  return NextResponse.json({ mode: "cloud", state: rows[0]?.data ?? null, updatedAt: rows[0]?.updated_at ?? null });
}

export async function PUT(request: NextRequest) {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ mode: "local", message: "DATABASE_URL is not configured" }, { status: 503 });
  }
  const data = await request.json();
  if (!data || !Array.isArray(data.spaces) || !Array.isArray(data.items)) {
    return NextResponse.json({ error: "Invalid inventory data" }, { status: 400 });
  }

  await ensureTable(sql);
  await sql`
    INSERT INTO nook_homes (id, data, updated_at)
    VALUES (${HOME_ID}, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  return NextResponse.json({ ok: true, mode: "cloud", updatedAt: new Date().toISOString() });
}
