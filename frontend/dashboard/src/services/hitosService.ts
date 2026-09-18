import { supabase } from '../lib/supabaseClient';
import type { Hito } from '../lib/tipos';
import { peticionApi } from './api';

export async function listarHitos(proyectoId: string): Promise<Hito[]> {
  const { data, error } = await supabase
    .from('hitos')
    .select('id, proyecto_id, nombre, etapa, fecha_planeada, fecha_real, estado')
    .eq('proyecto_id', proyectoId)
    .order('fecha_planeada', { nullsFirst: false });
  if (error) throw error;
  return data;
}

export interface DatosNuevoHito {
  nombre: string;
  etapa?: number | null;
  fecha_planeada?: string | null;
}

export function crearHito(proyectoId: string, datos: DatosNuevoHito): Promise<Hito> {
  return peticionApi<Hito>('POST', `/proyectos/${proyectoId}/hitos`, datos);
}

// No manda fecha_real: la ruta la fija en hoy sola al marcar cumplido — solo
// hace falta mandarla si se quiere cargar una fecha distinta a hoy.
export function cambiarEstadoHito(proyectoId: string, hitoId: string, estado: Hito['estado']): Promise<Hito> {
  return peticionApi<Hito>('PATCH', `/proyectos/${proyectoId}/hitos/${hitoId}`, { estado });
}

export function borrarHito(proyectoId: string, hitoId: string): Promise<void> {
  return peticionApi<void>('DELETE', `/proyectos/${proyectoId}/hitos/${hitoId}`);
}
