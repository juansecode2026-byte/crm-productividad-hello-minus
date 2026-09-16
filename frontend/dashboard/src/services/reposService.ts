import type { Proyecto, RepoCandidato } from '../lib/tipos';
import { peticionApi } from './api';

export function listarCandidatos(): Promise<RepoCandidato[]> {
  return peticionApi<RepoCandidato[]>('GET', '/repos/candidatos');
}

export interface DatosVincular {
  owner: string;
  repo: string;
  nombre: string;
  modalidad: 'individual' | 'equipo';
  etapa_inicial: number;
  fecha_inicio: string | null;
  // Solo en individual: en equipo el backend agrega a todas las personas
  // activas como líderes, no hay un único encargado que elegir.
  encargado_id?: string;
}

export function vincularRepo(datos: DatosVincular): Promise<{ proyecto: Proyecto }> {
  return peticionApi('POST', '/repos/vincular', datos);
}
