import type { EstimacionTarea } from '../lib/tipos';
import { peticionApi } from './api';

export function listarEstimaciones(proyectoId: string, tareaId: string): Promise<EstimacionTarea[]> {
  return peticionApi<EstimacionTarea[]>('GET', `/proyectos/${proyectoId}/tareas/${tareaId}/estimaciones`);
}

export interface DatosEstimacion {
  horas_estimadas: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export function crearEstimacion(
  proyectoId: string,
  tareaId: string,
  datos: DatosEstimacion,
): Promise<EstimacionTarea> {
  return peticionApi<EstimacionTarea>('POST', `/proyectos/${proyectoId}/tareas/${tareaId}/estimaciones`, datos);
}
