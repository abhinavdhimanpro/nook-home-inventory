import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { readLocalHome, writeLocalHome } from "../../../db/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOME_ID = "primary-home";

function databaseMissing() {
  return NextResponse.json({
    code: "DATABASE_NOT_CONFIGURED",
    message: "No cloud database is configured. Add DATABASE_URL to this Vercel project's Production environment and redeploy.",
  }, { status: 503 });
}

function databaseUnavailable() {
  return NextResponse.json({
    code: "DATABASE_UNAVAILABLE",
    message: "The cloud database could not be reached. Check DATABASE_URL and the Neon project status, then redeploy.",
  }, { status: 503 });
}

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
    if (process.env.VERCEL) return databaseMissing();
    const local = readLocalHome(HOME_ID);
    if (!local) return databaseMissing();
    return NextResponse.json({ mode: "local-database", state: local.state, updatedAt: local.updatedAt });
  }
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT data, updated_at FROM nook_homes WHERE id = ${HOME_ID}`;
    return NextResponse.json({ mode: "cloud", state: rows[0]?.data ?? null, updatedAt: rows[0]?.updated_at ?? null });
  } catch {
    return databaseUnavailable();
  }
}

export async function PUT(request: NextRequest) {
  const data = await request.json();
  if (!data || !Array.isArray(data.spaces) || !Array.isArray(data.items)) {
    return NextResponse.json({ error: "Invalid inventory data" }, { status: 400 });
  }

  const sql = getSql();
  if (!sql) {
    if (process.env.VERCEL) return databaseMissing();
    const updatedAt = writeLocalHome(HOME_ID, data);
    if (!updatedAt) return databaseMissing();
    return NextResponse.json({ ok: true, mode: "local-database", updatedAt });
  }

  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO nook_homes (id, data, updated_at)
      VALUES (${HOME_ID}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return NextResponse.json({ ok: true, mode: "cloud", updatedAt: new Date().toISOString() });
  } catch {
    return databaseUnavailable();
  }
}
