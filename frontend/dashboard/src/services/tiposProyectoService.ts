import { supabase } from '../lib/supabaseClient';
import type { TipoProyecto } from '../lib/tipos';

// Catálogo chico, igual que las 9 etapas: se lee directo, sin pasar por la
// API (leer_tipos_proyecto lo permite a cualquier autenticado).
export async function listarTiposProyecto(): Promise<TipoProyecto[]> {
  const { data, error } = await supabase.from('tipos_proyecto').select('id, nombre').order('nombre');
  if (error) throw error;
  return data;
}
