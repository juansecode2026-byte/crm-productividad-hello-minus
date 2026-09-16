import { supabase } from '../lib/supabaseClient';
import type { Proyecto } from '../lib/tipos';
import { peticionApi } from './api';

export async function listarProyectos(): Promise<Proyecto[]> {
  // Lectura directa a Supabase: RLS decide qué proyectos ve cada quien.
  const { data, error } = await supabase
    .from('proyectos')
    .select(
      'id, nombre, descripcion, estado, modalidad, etapa_actual, encargado_id, prioridad, fecha_inicio, fecha_objetivo, alcance_congelado_en',
    )
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data;
}

export interface DatosNuevoProyecto {
  nombre: string;
  descripcion?: string;
  modalidad: 'individual' | 'equipo';
  encargado_id?: string;
}

export function crearProyecto(datos: DatosNuevoProyecto): Promise<Proyecto> {
  return peticionApi<Proyecto>('POST', '/proyectos', datos);
}
