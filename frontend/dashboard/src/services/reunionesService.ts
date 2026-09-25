import type { Reunion } from '../lib/tipos';
import { peticionApi } from './api';

export function listarReuniones(proyectoId: string): Promise<Reunion[]> {
  return peticionApi<Reunion[]>('GET', `/proyectos/${proyectoId}/reuniones`);
}

export interface DatosReunion {
  fecha: string;
  horas: number;
  descripcion?: string | null;
}

export function registrarReunion(proyectoId: string, datos: DatosReunion): Promise<Reunion> {
  return peticionApi<Reunion>('POST', `/proyectos/${proyectoId}/reuniones`, datos);
}

export function borrarReunion(proyectoId: string, reunionId: string): Promise<void> {
  return peticionApi<void>('DELETE', `/proyectos/${proyectoId}/reuniones/${reunionId}`);
}
