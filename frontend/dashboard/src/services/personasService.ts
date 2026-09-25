import { supabase } from '../lib/supabaseClient';
import type { Persona } from '../lib/tipos';

export async function listarPersonasActivas(): Promise<Pick<Persona, 'id' | 'nombre'>[]> {
  const { data, error } = await supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre');
  if (error) throw error;
  return data;
}

// Para la página Equipo: además del nombre, necesita el rol para mostrarlo y
// el id para pedir la capacidad de cada quien.
export async function listarPersonasEquipo(): Promise<Pick<Persona, 'id' | 'nombre' | 'rol'>[]> {
  const { data, error } = await supabase
    .from('personas')
    .select('id, nombre, rol')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data;
}

export async function obtenerPersonaActual(): Promise<Pick<Persona, 'nombre' | 'rol'> | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('personas')
    .select('nombre, rol')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
