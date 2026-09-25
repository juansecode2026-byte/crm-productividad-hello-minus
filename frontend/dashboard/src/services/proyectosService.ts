import { supabase } from '../lib/supabaseClient';
import type { HistorialEtapa, Proyecto } from '../lib/tipos';
import { peticionApi } from './api';

const columnasProyecto =
  'id, nombre, descripcion, estado, modalidad, etapa_actual, encargado_id, tipo_id, prioridad, fecha_inicio, fecha_objetivo, fecha_limite, horas_estimadas, alcance_congelado_en';

export async function obtenerProyecto(id: string): Promise<Proyecto | null> {
  const { data, error } = await supabase.from('proyectos').select(columnasProyecto).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Alimenta el rail de etapas: una fila por etapa que el proyecto realmente
// visitó. Las que faltan entre 1 y etapa_actual se dedujeron "saltadas" en
// la página, no acá — es una decisión de presentación, no de datos.
export async function listarHistorialEtapas(proyectoId: string): Promise<HistorialEtapa[]> {
  const { data, error } = await supabase
    .from('historial_etapas')
    .select('etapa, entra_en, sale_en')
    .eq('proyecto_id', proyectoId)
    .order('entra_en');
  if (error) throw error;
  return data;
}

export async function listarProyectos(): Promise<Proyecto[]> {
  // Lectura directa a Supabase: RLS decide qué proyectos ve cada quien.
  const { data, error } = await supabase
    .from('proyectos')
    .select(columnasProyecto)
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

export interface DatosEditarProyecto {
  nombre?: string;
  descripcion?: string | null;
  tipo_id?: string | null;
  prioridad?: number | null;
  estado?: 'activo' | 'pausado' | 'archivado';
  fecha_objetivo?: string | null;
  fecha_limite?: string | null;
  horas_estimadas?: number | null;
}

export function actualizarProyecto(id: string, cambios: DatosEditarProyecto): Promise<Proyecto> {
  return peticionApi<Proyecto>('PATCH', `/proyectos/${id}`, cambios);
}
