export type SaludPlanta = 'Excelente' | 'Buena' | 'Requiere Atención' | 'Crítica';

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
}
