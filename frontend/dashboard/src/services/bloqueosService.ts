import { supabase } from '../lib/supabaseClient';
import type { Bloqueo } from '../lib/tipos';
import { peticionApi } from './api';

export async function listarBloqueos(proyectoId: string): Promise<Bloqueo[]> {
  const { data, error } = await supabase
    .from('bloqueos')
    .select('id, proyecto_id, persona_id, descripcion, tipo, abierto_en, resuelto_en, resuelto_por')
    .eq('proyecto_id', proyectoId)
    .order('abierto_en', { ascending: false });
  if (error) throw error;
  return data;
}

export function abrirBloqueo(proyectoId: string, descripcion: string, tipo?: Bloqueo['tipo']): Promise<Bloqueo> {
  return peticionApi<Bloqueo>('POST', `/proyectos/${proyectoId}/bloqueos`, { descripcion, tipo });
}

export function resolverBloqueo(proyectoId: string, bloqueoId: string): Promise<Bloqueo> {
  return peticionApi<Bloqueo>('POST', `/proyectos/${proyectoId}/bloqueos/${bloqueoId}/resolver`);
}
