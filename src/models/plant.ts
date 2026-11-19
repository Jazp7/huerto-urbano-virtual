import { getDb, resetDatabase, saveDatabaseToStorage } from '../db/database.ts';
import type { EstadoRiego, Planta, Riego, SaludPlanta } from './types.ts';

export { getDb };

/**
 * Returns all plants ordered by newest first.
 */
export function getAllPlantas(): Planta[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas, creada_en FROM plantas ORDER BY id DESC'
  );
  const plantas: Planta[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    plantas.push({
      id: Number(row.id),
      nombre: String(row.nombre),
      especie: String(row.especie),
      icono: String(row.icono || '🌱'),
      frecuencia_dias: Number(row.frecuencia_dias),
      ultimo_riego: String(row.ultimo_riego),
      salud: row.salud as SaludPlanta,
      notas: String(row.notas ?? ''),
      creada_en: String(row.creada_en)
    });
  }
  stmt.free();
  return plantas;
}

/**
 * Finds a plant by its unique ID. Returns null if not found.
 */
export function getPlantaById(id: number): Planta | null {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas, creada_en FROM plantas WHERE id = ?'
  );
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: Number(row.id),
      nombre: String(row.nombre),
      especie: String(row.especie),
      icono: String(row.icono || '🌱'),
      frecuencia_dias: Number(row.frecuencia_dias),
      ultimo_riego: String(row.ultimo_riego),
      salud: row.salud as SaludPlanta,
      notas: String(row.notas ?? ''),
      creada_en: String(row.creada_en)
    };
  }
  stmt.free();
  return null;
}

/**
 * Creates a new plant record and persists changes to localStorage.
 */
export function createPlanta(planta: Omit<Planta, 'id' | 'creada_en'>): Planta {
  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO plantas (nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas, creada_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planta.nombre,
      planta.especie,
      planta.icono || '🌱',
      planta.frecuencia_dias,
      planta.ultimo_riego,
      planta.salud || 'Excelente',
      planta.notas || '',
      now
    ]
  );

  const result = db.exec('SELECT last_insert_rowid() AS id');
  const id = Number(result[0]?.values[0]?.[0] ?? 0);

  saveDatabaseToStorage();

  return {
    id,
    nombre: planta.nombre,
    especie: planta.especie,
    icono: planta.icono || '🌱',
    frecuencia_dias: planta.frecuencia_dias,
    ultimo_riego: planta.ultimo_riego,
    salud: planta.salud || 'Excelente',
    notas: planta.notas || '',
    creada_en: now
  };
}

/**
 * Updates an existing plant's fields and persists changes to localStorage.
 */
export function updatePlanta(
  id: number,
  planta: Partial<Omit<Planta, 'id' | 'creada_en'>>
): boolean {
  const db = getDb();
  const setClauses: string[] = [];
  const params: (string | number)[] = [];

  if (planta.nombre !== undefined) {
    setClauses.push('nombre = ?');
    params.push(planta.nombre);
  }
  if (planta.especie !== undefined) {
    setClauses.push('especie = ?');
    params.push(planta.especie);
  }
  if (planta.icono !== undefined) {
    setClauses.push('icono = ?');
    params.push(planta.icono);
  }
  if (planta.frecuencia_dias !== undefined) {
    setClauses.push('frecuencia_dias = ?');
    params.push(planta.frecuencia_dias);
  }
  if (planta.ultimo_riego !== undefined) {
    setClauses.push('ultimo_riego = ?');
    params.push(planta.ultimo_riego);
  }
  if (planta.salud !== undefined) {
    setClauses.push('salud = ?');
    params.push(planta.salud);
  }
  if (planta.notas !== undefined) {
    setClauses.push('notas = ?');
    params.push(planta.notas);
  }

  if (setClauses.length === 0) {
    return true;
  }

  params.push(id);
  db.run(`UPDATE plantas SET ${setClauses.join(', ')} WHERE id = ?`, params);
  const modified = db.getRowsModified();
  if (modified > 0) {
    saveDatabaseToStorage();
    return true;
  }
  return false;
}

/**
 * Deletes a plant and cascades deletion to all associated watering records.
 */
export function deletePlanta(id: number): boolean {
  const db = getDb();
  db.run('DELETE FROM plantas WHERE id = ?', [id]);
  const modified = db.getRowsModified();
  if (modified > 0) {
    saveDatabaseToStorage();
    return true;
  }
  return false;
}

/**
 * Records a new watering event for a plant, updates its ultimo_riego date, and saves to storage.
 */
export function registrarRiego(
  plantaId: number,
  cantidadMl: number = 250,
  observaciones: string = '',
  fecha?: string
): Riego {
  const db = getDb();
  const fechaRiego = fecha || new Date().toISOString().split('T')[0];

  db.run(
    'INSERT INTO riegos (planta_id, fecha, cantidad_ml, observaciones) VALUES (?, ?, ?, ?)',
    [plantaId, fechaRiego, cantidadMl, observaciones]
  );

  const result = db.exec('SELECT last_insert_rowid() AS id');
  const id = Number(result[0]?.values[0]?.[0] ?? 0);

  // Update ultimo_riego on the plant
  db.run('UPDATE plantas SET ultimo_riego = ? WHERE id = ?', [fechaRiego, plantaId]);

  saveDatabaseToStorage();

  return {
    id,
    planta_id: plantaId,
    fecha: fechaRiego,
    cantidad_ml: cantidadMl,
    observaciones
  };
}

/**
 * Retrieves all watering records for a specific plant, ordered newest first.
 */
export function getRiegosByPlanta(plantaId: number): Riego[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, planta_id, fecha, cantidad_ml, observaciones FROM riegos WHERE planta_id = ? ORDER BY fecha DESC, id DESC'
  );
  stmt.bind([plantaId]);
  const riegos: Riego[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    riegos.push({
      id: Number(row.id),
      planta_id: Number(row.planta_id),
      fecha: String(row.fecha),
      cantidad_ml: Number(row.cantidad_ml),
      observaciones: String(row.observaciones ?? '')
    });
  }
  stmt.free();
  return riegos;
}

/**
 * Deletes a specific watering record by ID and updates the plant's ultimo_riego to the next most recent watering.
 */
export function deleteRiego(id: number): boolean {
  const db = getDb();
  const query = db.exec('SELECT planta_id FROM riegos WHERE id = ?', [id]);
  if (!query.length || !query[0].values.length) {
    return false;
  }
  const plantaId = Number(query[0].values[0][0]);

  db.run('DELETE FROM riegos WHERE id = ?', [id]);
  const modified = db.getRowsModified();
  if (modified > 0) {
    const latestRiego = db.exec(
      'SELECT fecha FROM riegos WHERE planta_id = ? ORDER BY fecha DESC, id DESC LIMIT 1',
      [plantaId]
    );
    if (latestRiego.length && latestRiego[0].values.length) {
      const latestFecha = String(latestRiego[0].values[0][0]);
      db.run('UPDATE plantas SET ultimo_riego = ? WHERE id = ?', [latestFecha, plantaId]);
    }
    saveDatabaseToStorage();
    return true;
  }
  return false;
}

/**
 * Resets the entire database to the initial demo plants and records.
 */
export async function resetDemoData(): Promise<void> {
  await resetDatabase();
}

export const resetToDemoData = resetDemoData;

/**
 * Calculates watering state, hydration percentage, and delay/remaining days for a plant.
 */
export function calcularEstadoRiego(planta: Planta): EstadoRiego {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = planta.ultimo_riego.split('T')[0].split('-').map(Number);
  const ultimoRiegoDate = new Date(year, (month || 1) - 1, day || 1);
  ultimoRiegoDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - ultimoRiegoDate.getTime();
  const diasTranscurridos = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const diasRestantes = Math.max(0, planta.frecuencia_dias - diasTranscurridos);
  const diasRetraso = Math.max(0, diasTranscurridos - planta.frecuencia_dias);
  const necesitaAgua = diasTranscurridos >= planta.frecuencia_dias;

  const porcentajeHidratacion = diasTranscurridos >= planta.frecuencia_dias
    ? 0
    : Math.max(0, Math.min(100, Math.round(((planta.frecuencia_dias - diasTranscurridos) / planta.frecuencia_dias) * 100)));

  let mensaje = '';
  let badgeClass = '';

  if (diasRetraso > 2) {
    mensaje = `¡Urgente! Retraso de ${diasRetraso} días`;
    badgeClass = 'badge-danger';
  } else if (diasRetraso > 0) {
    mensaje = `Retraso de ${diasRetraso} día${diasRetraso > 1 ? 's' : ''}`;
    badgeClass = 'badge-warning';
  } else if (diasRestantes === 0) {
    mensaje = 'Toca regar hoy';
    badgeClass = 'badge-warning';
  } else if (diasRestantes === 1) {
    mensaje = 'Regar mañana';
    badgeClass = 'badge-info';
  } else {
    mensaje = `Próximo riego en ${diasRestantes} días`;
    badgeClass = 'badge-success';
  }

  return {
    necesitaAgua,
    diasRestantes,
    diasRetraso,
    porcentajeHidratacion,
    mensaje,
    badgeClass
  };
}
