import { supabase } from '../lib/supabaseClient';
import type { ChecklistItem } from '../lib/tipos';
import { peticionApi } from './api';

export async function listarChecklist(proyectoId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('id, proyecto_id, etapa, texto, completado, completado_por, completado_en')
    .eq('proyecto_id', proyectoId)
    .order('etapa')
    .order('texto');
  if (error) throw error;
  return data;
}

export function crearItemChecklist(proyectoId: string, etapa: number, texto: string): Promise<ChecklistItem> {
  return peticionApi<ChecklistItem>('POST', `/proyectos/${proyectoId}/checklist`, { etapa, texto });
}

export function marcarItemChecklist(
  proyectoId: string,
  itemId: string,
  completado: boolean,
): Promise<ChecklistItem> {
  return peticionApi<ChecklistItem>('PATCH', `/proyectos/${proyectoId}/checklist/${itemId}`, { completado });
}

export function borrarItemChecklist(proyectoId: string, itemId: string): Promise<void> {
  return peticionApi<void>('DELETE', `/proyectos/${proyectoId}/checklist/${itemId}`);
}
