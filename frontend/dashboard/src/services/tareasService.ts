import { supabase } from '../lib/supabaseClient';
import type { TareaEvidencia, TareaSemanal } from '../lib/tipos';
import { peticionApi } from './api';

export interface TareaConEvidencia extends TareaSemanal {
  tarea_evidencia: TareaEvidencia[];
}

// El rastro (tarea_evidencia) lo escribe solo el Detector semanal — nunca a
// mano — así que acá alcanza con leerlo anidado en la misma consulta.
export async function listarTareas(proyectoId: string): Promise<TareaConEvidencia[]> {
  const { data, error } = await supabase
    .from('tareas_semanales')
    .select('*, tarea_evidencia(*)')
    .eq('proyecto_id', proyectoId)
    .order('semana_inicio', { ascending: false });
  if (error) throw error;
  return data;
}

export interface DatosNuevaTarea {
  titulo: string;
  semana_inicio: string;
  semana_fin: string;
  areas: string[];
  persona_id?: string;
}

export function crearTarea(proyectoId: string, datos: DatosNuevaTarea): Promise<TareaSemanal> {
  return peticionApi<TareaSemanal>('POST', `/proyectos/${proyectoId}/tareas`, datos);
}

// La fecha de cierre la fija el servidor, no se manda desde acá.
export function marcarTarea(proyectoId: string, tareaId: string, completado: boolean): Promise<TareaSemanal> {
  return peticionApi<TareaSemanal>('PATCH', `/proyectos/${proyectoId}/tareas/${tareaId}`, { completado });
}

export function borrarTarea(proyectoId: string, tareaId: string): Promise<void> {
  return peticionApi<void>('DELETE', `/proyectos/${proyectoId}/tareas/${tareaId}`);
}
