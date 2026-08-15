import { mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

type LocalRow = {
  data: string;
  updated_at: string;
};

const databaseCache = globalThis as typeof globalThis & { nookLocalDatabase?: DatabaseSync };

function getDatabase() {
  const configuredPath = process.env.LOCAL_DATABASE_PATH;
  if (!configuredPath) return null;
  if (databaseCache.nookLocalDatabase) return databaseCache.nookLocalDatabase;

  const databasePath = resolve(process.cwd(), ".data", basename(configuredPath));
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS nook_homes (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  databaseCache.nookLocalDatabase = database;
  return database;
}

export function readLocalHome(id: string) {
  const database = getDatabase();
  if (!database) return null;
  const row = database.prepare("SELECT data, updated_at FROM nook_homes WHERE id = ?").get(id) as LocalRow | undefined;
  if (!row) return { state: null, updatedAt: null };
  return { state: JSON.parse(row.data) as unknown, updatedAt: row.updated_at };
}

export function writeLocalHome(id: string, data: unknown) {
  const database = getDatabase();
  if (!database) return null;
  const updatedAt = new Date().toISOString();
  database.prepare(`
    INSERT INTO nook_homes (id, data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(id, JSON.stringify(data), updatedAt);
  return updatedAt;
}
