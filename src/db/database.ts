import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { getLocalDateString } from '../models/types.ts';

const STORAGE_KEY = 'huerto_urbano_sqlite_db';

let dbInstance: Database | null = null;
let sqlStatic: SqlJsStatic | null = null;

/**
 * Converts a Uint8Array into a base64 encoded string using chunking to prevent call stack issues.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string back into a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Returns the active Database instance, or throws if not yet initialized.
 */
export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database is not initialized. Please call initDatabase() first.');
  }
  return dbInstance;
}

/**
 * Saves the current SQLite database state into localStorage as a base64 encoded string.
 */
export function saveDatabaseToStorage(): void {
  if (!dbInstance) {
    throw new Error('Database is not initialized');
  }
  const binary = dbInstance.export();
  const base64 = uint8ArrayToBase64(binary);
  localStorage.setItem(STORAGE_KEY, base64);
}

/**
 * Generates an ISO date string (YYYY-MM-DD) shifted by a given number of days from today.
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getLocalDateString(date);
}

/**
 * Creates the database schema and seeds initial demo data with realistic watering history.
 */
export function seedDatabase(db: Database): void {
  db.run('PRAGMA foreign_keys = ON;');

  db.run(`
    CREATE TABLE IF NOT EXISTS plantas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      especie TEXT NOT NULL,
      icono TEXT DEFAULT '🌱',
      frecuencia_dias INTEGER NOT NULL DEFAULT 3,
      ultimo_riego TEXT NOT NULL,
      salud TEXT DEFAULT 'Excelente',
      notas TEXT,
      creada_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS riegos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planta_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      cantidad_ml INTEGER DEFAULT 250,
      observaciones TEXT,
      FOREIGN KEY (planta_id) REFERENCES plantas(id) ON DELETE CASCADE
    );
  `);

  const demoPlants = [
    {
      nombre: 'Tomate Cherry',
      especie: 'Solanum lycopersicum',
      icono: '🍅',
      frecuencia_dias: 2,
      ultimo_riego: getDateDaysAgo(1),
      salud: 'Excelente',
      notas: 'Ubicado en terraza con sol directo. Requiere entutorado firme y buena humedad.',
      riegos: [
        { fecha: getDateDaysAgo(5), cantidad_ml: 300, observaciones: 'Riego inicial de la semana con abono orgánico' },
        { fecha: getDateDaysAgo(3), cantidad_ml: 250, observaciones: 'Riego matutino moderado' },
        { fecha: getDateDaysAgo(1), cantidad_ml: 250, observaciones: 'Riego de mantenimiento antes de brotes' }
      ]
    },
    {
      nombre: 'Menta Silvestre',
      especie: 'Mentha spicata',
      icono: '🌿',
      frecuencia_dias: 3,
      ultimo_riego: getDateDaysAgo(2),
      salud: 'Buena',
      notas: 'Crecimiento vigoroso en maceta individual. Aroma fresco para infusiones caseras.',
      riegos: [
        { fecha: getDateDaysAgo(8), cantidad_ml: 200, observaciones: 'Riego suave foliar y base' },
        { fecha: getDateDaysAgo(5), cantidad_ml: 200, observaciones: 'Riego vespertino' },
        { fecha: getDateDaysAgo(2), cantidad_ml: 200, observaciones: 'Mantenimiento de humedad en sustrato' }
      ]
    },
    {
      nombre: 'Suculenta Cebra',
      especie: 'Haworthiopsis fasciata',
      icono: '🌵',
      frecuencia_dias: 10,
      ultimo_riego: getDateDaysAgo(5),
      salud: 'Excelente',
      notas: 'Interior junto a ventana con luz indirecta tamizada. Cuidado con excesos de agua.',
      riegos: [
        { fecha: getDateDaysAgo(25), cantidad_ml: 120, observaciones: 'Riego mensual con atomizador' },
        { fecha: getDateDaysAgo(15), cantidad_ml: 100, observaciones: 'Riego ligero en el borde de la maceta' },
        { fecha: getDateDaysAgo(5), cantidad_ml: 120, observaciones: 'Hidratación moderada de sustrato seco' }
      ]
    },
    {
      nombre: 'Albahaca Italiana',
      especie: 'Ocimum basilicum',
      icono: '🌱',
      frecuencia_dias: 2,
      ultimo_riego: getDateDaysAgo(3),
      salud: 'Requiere Atención',
      notas: 'Hojas un poco decaídas por calor. Requiere riego urgente y poda preventiva de flores.',
      riegos: [
        { fecha: getDateDaysAgo(7), cantidad_ml: 250, observaciones: 'Riego profundo de tarde' },
        { fecha: getDateDaysAgo(5), cantidad_ml: 200, observaciones: 'Riego rápido antes de mediodía' },
        { fecha: getDateDaysAgo(3), cantidad_ml: 200, observaciones: 'Riego moderado con sustrato drenante' }
      ]
    }
  ];

  for (const plant of demoPlants) {
    db.run(
      `INSERT INTO plantas (nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        plant.nombre,
        plant.especie,
        plant.icono,
        plant.frecuencia_dias,
        plant.ultimo_riego,
        plant.salud,
        plant.notas
      ]
    );

    const plantIdResult = db.exec('SELECT last_insert_rowid() AS id');
    const plantId = Number(plantIdResult[0].values[0][0]);

    for (const riego of plant.riegos) {
      db.run(
        `INSERT INTO riegos (planta_id, fecha, cantidad_ml, observaciones)
         VALUES (?, ?, ?, ?)`,
        [plantId, riego.fecha, riego.cantidad_ml, riego.observaciones]
      );
    }
  }
}

/**
 * Initializes the SQLite database engine using WebAssembly.
 * Restores data from localStorage if available, or seeds fresh demo data.
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!sqlStatic) {
    sqlStatic = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm'
    });
  }

  const savedBase64 = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

  if (savedBase64) {
    try {
      const bytes = base64ToUint8Array(savedBase64);
      dbInstance = new sqlStatic.Database(bytes);
      dbInstance.run('PRAGMA foreign_keys = ON;');
      return dbInstance;
    } catch (err) {
      console.warn('Failed to restore database from localStorage, re-initializing fresh demo data:', err);
    }
  }

  dbInstance = new sqlStatic.Database();
  seedDatabase(dbInstance);
  saveDatabaseToStorage();
  return dbInstance;
}

/**
 * Clears saved state from localStorage, closes the active database, and re-initializes fresh demo data.
 */
export async function resetDatabase(): Promise<Database> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  return initDatabase();
}
