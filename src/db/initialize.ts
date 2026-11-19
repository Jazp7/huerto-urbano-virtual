// -------------------------------------------------
// Database initialization helpers for Turso
// -------------------------------------------------
// ensureTables() creates the schema if it does not exist.
// seedDemoData() (optional) inserts a few demo plants and riegos the
// first time the database is empty.

import { exec, execNoRows } from "./tursoClient.ts";
export async function ensureTables(): Promise<void> {
  // plantas table
  await execNoRows(`
    CREATE TABLE IF NOT EXISTS plantas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      especie TEXT NOT NULL,
      icono TEXT,
      frecuencia_dias INTEGER NOT NULL,
      ultimo_riego TEXT NOT NULL,
      salud TEXT NOT NULL,
      notas TEXT,
      creada_en TEXT NOT NULL
    );
  `);

  // riegos table
  await execNoRows(`
    CREATE TABLE IF NOT EXISTS riegos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planta_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      cantidad_ml INTEGER NOT NULL,
      observaciones TEXT,
      FOREIGN KEY(planta_id) REFERENCES plantas(id) ON DELETE CASCADE
    );
  `);
}

/** Insert demo data only when the database is empty */
export async function seedDemoData(): Promise<void> {
  const [{ count }] = await exec(`SELECT COUNT(*) as count FROM plantas`);
  if (Number(count) > 0) return; // already has data

  const now = new Date().toISOString().split("T")[0];

  // Demo plants
  await execNoRows(`
    INSERT INTO plantas (nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas, creada_en)
    VALUES
      ('Tomate Cherry', 'Solanum lycopersicum', '🍅', 3, ?, 'Excelente', 'En maceta, luz directa', ?),
      ('Albahaca', 'Ocimum basilicum', '🌿', 2, ?, 'Buena', 'Rocío de mañana', ?),
      ('Lavanda', 'Lavandula angustifolia', '🌸', 5, ?, 'Requiere Atención', 'Necesita buen drenaje', ?);
  `, [now, now, now, now, now, now]);

  // Demo riegos (for the first plant)
  await execNoRows(`
    INSERT INTO riegos (planta_id, fecha, cantidad_ml, observaciones)
    VALUES (1, ?, 250, 'Riego inicial');
  `, [now]);
}
