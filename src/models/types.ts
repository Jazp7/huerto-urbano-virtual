export type SaludPlanta = 'Excelente' | 'Buena' | 'Requiere Atención' | 'Crítica';

/**
 * Returns a local date string in YYYY-MM-DD format (avoids UTC timezone shifting).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface Planta {
  id: number;
  nombre: string;
  especie: string;
  icono: string;
  frecuencia_dias: number;
  ultimo_riego: string;
  salud: SaludPlanta;
  notas: string;
  creada_en: string;
}

export interface Riego {
  id: number;
  planta_id: number;
  fecha: string;
  cantidad_ml: number;
  observaciones: string;
}

export interface EstadoRiego {
  necesitaAgua: boolean;
  diasRestantes: number;
  diasRetraso: number;
  porcentajeHidratacion: number;
  mensaje: string;
  badgeClass: string;
  diasTranscurridos: number;
}
