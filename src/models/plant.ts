import { exec, execNoRows } from '../db/tursoClient.ts';
import { getLocalDateString, type EstadoRiego, type Planta, type Riego, type SaludPlanta } from './types.ts';

export interface ResultadoRiego extends Riego { saludMejorada: boolean; saludAnterior: SaludPlanta; nuevaSalud: SaludPlanta; }
type Row = Record<string, unknown>;

function toPlanta(row: Row): Planta { return { id: Number(row.id), nombre: String(row.nombre), especie: String(row.especie), icono: String(row.icono ?? '🌱'), frecuencia_dias: Number(row.frecuencia_dias), ultimo_riego: String(row.ultimo_riego), salud: row.salud as SaludPlanta, notas: String(row.notas ?? ''), creada_en: String(row.creada_en) }; }
function toRiego(row: Row): Riego { return { id: Number(row.id), planta_id: Number(row.planta_id), fecha: String(row.fecha), cantidad_ml: Number(row.cantidad_ml), observaciones: String(row.observaciones ?? '') }; }

export async function getAllPlantas(): Promise<Planta[]> { const rows = await exec('SELECT id, nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas, creada_en FROM plantas ORDER BY id DESC'); return rows.map((row) => toPlanta(row as Row)); }
export async function getPlantaById(id: number): Promise<Planta | null> { const rows = await exec('SELECT id, nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas, creada_en FROM plantas WHERE id = ?', [id]); return rows.length ? toPlanta(rows[0] as Row) : null; }

export async function createPlanta(planta: Omit<Planta, 'id' | 'creada_en'>): Promise<Planta> {
  const now = new Date().toISOString(); const icono = planta.icono || '🌱'; const salud = planta.salud || 'Excelente'; const notas = planta.notas || '';
  const rows = await exec('INSERT INTO plantas (nombre, especie, icono, frecuencia_dias, ultimo_riego, salud, notas, creada_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id', [planta.nombre, planta.especie, icono, planta.frecuencia_dias, planta.ultimo_riego, salud, notas, now]);
  return { ...planta, id: Number((rows[0] as Row)?.id ?? 0), icono, salud, notas, creada_en: now };
}

export async function updatePlanta(id: number, planta: Partial<Omit<Planta, 'id' | 'creada_en'>>): Promise<boolean> {
  const fields: Array<[string, string | number]> = [];
  if (planta.nombre !== undefined) fields.push(['nombre', planta.nombre]); if (planta.especie !== undefined) fields.push(['especie', planta.especie]); if (planta.icono !== undefined) fields.push(['icono', planta.icono]); if (planta.frecuencia_dias !== undefined) fields.push(['frecuencia_dias', planta.frecuencia_dias]); if (planta.ultimo_riego !== undefined) fields.push(['ultimo_riego', planta.ultimo_riego]); if (planta.salud !== undefined) fields.push(['salud', planta.salud]); if (planta.notas !== undefined) fields.push(['notas', planta.notas]);
  if (!fields.length) return true; await execNoRows(`UPDATE plantas SET ${fields.map(([field]) => `${field} = ?`).join(', ')} WHERE id = ?`, [...fields.map(([, value]) => value), id]); const rows = await exec('SELECT changes() AS changed'); return Number((rows[0] as Row)?.changed ?? 0) > 0;
}
export async function deletePlanta(id: number): Promise<boolean> { await execNoRows('DELETE FROM riegos WHERE planta_id = ?', [id]); await execNoRows('DELETE FROM plantas WHERE id = ?', [id]); const rows = await exec('SELECT changes() AS changed'); return Number((rows[0] as Row)?.changed ?? 0) > 0; }

export async function registrarRiego(plantaId: number, cantidadMl = 250, observaciones = '', fecha?: string): Promise<ResultadoRiego> {
  const fechaRiego = fecha || getLocalDateString(); const currentPlant = await getPlantaById(plantaId); if (!currentPlant) throw new Error('La planta no existe');
  const saludAnterior = currentPlant.salud; const nuevaSalud: SaludPlanta = saludAnterior === 'Requiere Atención' ? 'Excelente' : saludAnterior === 'Crítica' ? 'Buena' : saludAnterior; const saludMejorada = nuevaSalud !== saludAnterior;
  const rows = await exec('INSERT INTO riegos (planta_id, fecha, cantidad_ml, observaciones) VALUES (?, ?, ?, ?) RETURNING id', [plantaId, fechaRiego, cantidadMl, observaciones]); await execNoRows('UPDATE plantas SET ultimo_riego = ?, salud = ? WHERE id = ?', [fechaRiego, nuevaSalud, plantaId]);
  return { id: Number((rows[0] as Row)?.id ?? 0), planta_id: plantaId, fecha: fechaRiego, cantidad_ml: cantidadMl, observaciones, saludMejorada, saludAnterior, nuevaSalud };
}
export async function getRiegosByPlanta(plantaId: number): Promise<Riego[]> { const rows = await exec('SELECT id, planta_id, fecha, cantidad_ml, observaciones FROM riegos WHERE planta_id = ? ORDER BY fecha DESC, id DESC', [plantaId]); return rows.map((row) => toRiego(row as Row)); }
export async function deleteRiego(id: number): Promise<boolean> { const rows = await exec('SELECT planta_id FROM riegos WHERE id = ?', [id]); const plantaId = Number((rows[0] as Row | undefined)?.planta_id); if (!plantaId) return false; await execNoRows('DELETE FROM riegos WHERE id = ?', [id]); const changed = await exec('SELECT changes() AS changed'); if (Number((changed[0] as Row)?.changed ?? 0) === 0) return false; const latest = await exec('SELECT fecha FROM riegos WHERE planta_id = ? ORDER BY fecha DESC, id DESC LIMIT 1', [plantaId]); if (latest.length) await execNoRows('UPDATE plantas SET ultimo_riego = ? WHERE id = ?', [String((latest[0] as Row).fecha), plantaId]); return true; }

export async function resetDemoData(): Promise<void> { await execNoRows('DELETE FROM riegos'); await execNoRows('DELETE FROM plantas'); const { seedDemoData } = await import('../db/initialize.ts'); await seedDemoData(); }
export const resetToDemoData = resetDemoData;

export function calcularEstadoRiego(planta: Planta): EstadoRiego {
  const today = new Date(); today.setHours(0, 0, 0, 0); const [year, month, day] = planta.ultimo_riego.split('T')[0].split('-').map(Number); const last = new Date(year, (month || 1) - 1, day || 1); last.setHours(0, 0, 0, 0); const diasTranscurridos = Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86400000)); const diasRestantes = Math.max(0, planta.frecuencia_dias - diasTranscurridos); const diasRetraso = Math.max(0, diasTranscurridos - planta.frecuencia_dias); const necesitaAgua = diasTranscurridos >= planta.frecuencia_dias; const porcentajeHidratacion = necesitaAgua ? 0 : Math.max(0, Math.min(100, Math.round(((planta.frecuencia_dias - diasTranscurridos) / planta.frecuencia_dias) * 100)));
  let mensaje = ''; let badgeClass = ''; if (diasRetraso > 2) { mensaje = `¡Urgente! Retraso de ${diasRetraso} días`; badgeClass = 'badge-danger'; } else if (diasRetraso > 0) { mensaje = `Retraso de ${diasRetraso} día${diasRetraso > 1 ? 's' : ''}`; badgeClass = 'badge-warning'; } else if (!diasRestantes) { mensaje = 'Toca regar hoy'; badgeClass = 'badge-warning'; } else if (!diasTranscurridos) { mensaje = planta.frecuencia_dias === 1 ? '💧 Regada hoy • Mañana toca riego' : `💧 Regada hoy • Próximo en ${planta.frecuencia_dias} días`; badgeClass = 'badge-success'; } else if (diasRestantes === 1) { mensaje = 'Regar mañana'; badgeClass = 'badge-info'; } else { mensaje = `Próximo riego en ${diasRestantes} días`; badgeClass = 'badge-success'; }
  return { necesitaAgua, diasRestantes, diasRetraso, porcentajeHidratacion, mensaje, badgeClass, diasTranscurridos };
}
