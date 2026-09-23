import { supabase } from '../lib/supabaseClient';
import type { ChecklistItem, ResultadoEscaneo } from '../lib/tipos';
import { peticionApi } from './api';

export async function listarChecklist(proyectoId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select(
      'id, proyecto_id, etapa, texto, completado, completado_por, completado_en, estado_agente, verificado_en, evidencia',
    )
    .eq('proyecto_id', proyectoId)
    .order('etapa')
    .order('texto');
  if (error) throw error;
  return data;
}

// La explicación en palabras simples vive en la plantilla, no en el ítem del
// proyecto: es la misma para todos, así que corregir una redacción la arregla
// en todas partes sin re-escanear. Se devuelve indexada por etapa y texto,
// que es lo que comparten `checklist_plantilla` y `checklist_items`.
export async function listarExplicaciones(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('checklist_plantilla')
    .select('etapa, texto, explicacion_simple')
    .eq('activo', true);
  if (error) throw error;
  return new Map(
    data
      .filter((fila) => fila.explicacion_simple !== null)
      .map((fila) => [`${fila.etapa}|${fila.texto}`, fila.explicacion_simple as string]),
  );
}

// Siembra los ítems de la plantilla que falten y deja marcado lo que el agente
// cree ya hecho. Nunca marca `completado` — eso sigue siendo un clic humano.
export function escanearChecklist(proyectoId: string): Promise<ResultadoEscaneo> {
  return peticionApi<ResultadoEscaneo>('POST', `/proyectos/${proyectoId}/checklist/escanear`);
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
