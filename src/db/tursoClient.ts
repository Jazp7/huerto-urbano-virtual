// Turso client wrapper for SQLite operations
// -------------------------------------------------
// This file provides thin async helpers around the official @libsql/client
// library.  They are used throughout the code‑base instead of the previous
// sql.js / local‑storage approach.

import { createClient } from '@libsql/client';

type SqlParam = string | number | bigint | Uint8Array | null | boolean;

// Turso credentials are injected via environment variables (Vercel adds them
// automatically when you configure them in the dashboard).  During local
// development you can set them in a .env file.
const url = import.meta.env.VITE_TURSO_URL;
const authToken = import.meta.env.VITE_TURSO_TOKEN;

if (!url || !authToken) {
  throw new Error('Faltan VITE_TURSO_URL y VITE_TURSO_TOKEN en el archivo .env');
}

const client = createClient({ url, authToken });

/**
 * Execute a query that returns rows (SELECT).  The result is an array of plain
 * objects where column names are the keys.
 */
export async function exec(sql: string, params: SqlParam[] = []): Promise<Record<string, unknown>[]> {
  const result = await client.execute(sql, params);
  return result.rows as unknown as Record<string, unknown>[];
}

/**
 * Execute a statement that does not need to return rows (INSERT, UPDATE,
 * DELETE, CREATE, etc.).
 */
export async function execNoRows(sql: string, params: SqlParam[] = []): Promise<void> {
  await client.execute(sql, params);
}
