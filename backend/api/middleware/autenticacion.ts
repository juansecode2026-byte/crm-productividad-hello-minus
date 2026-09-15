import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request, RequestHandler } from 'express';
import { config } from '../config.js';
import type { Database } from '../database.types.js';
import { desdeSupabase, ErrorHttp } from './errores.js';

export type ClienteSupabase = SupabaseClient<Database>;

export interface PersonaActual {
  id: string;
  rol: Database['public']['Enums']['rol_global'];
}

interface Contexto {
  supabase: ClienteSupabase;
  persona: PersonaActual;
}

const opcionesSinSesion = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// Un solo cliente para verificar tokens: guarda en caché las llaves públicas
// (JWKS) del proyecto y evita pedirlas en cada petición.
const verificador = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: opcionesSinSesion,
});

const contextos = new WeakMap<Request, Contexto>();

// getClaims devuelve `error` si la firma o el vencimiento fallan, pero lanza si
// el token ni siquiera se puede decodificar. Las dos cosas son un 401.
async function verificarToken(token: string) {
  try {
    const { data, error } = await verificador.auth.getClaims(token);
    return error ? null : data;
  } catch {
    return null;
  }
}

export const exigirSesion: RequestHandler = async (req, _res, next) => {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    throw new ErrorHttp(401, 'Falta el token de sesión');
  }

  const verificado = await verificarToken(token);
  if (!verificado) {
    throw new ErrorHttp(401, 'Sesión inválida o vencida');
  }

  // El cliente de la petición viaja con el token del usuario: toda consulta
  // pasa por RLS con su identidad. La API nunca usa service_role.
  const supabase = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: opcionesSinSesion,
  });

  const { data: persona, error } = await supabase
    .from('personas')
    .select('id, rol, activo')
    .eq('auth_user_id', verificado.claims.sub)
    .maybeSingle();

  if (error) throw desdeSupabase(error);
  if (!persona) throw new ErrorHttp(403, 'Tu usuario no está vinculado a una persona del equipo');
  if (!persona.activo) throw new ErrorHttp(403, 'Tu usuario está inactivo');

  contextos.set(req, { supabase, persona: { id: persona.id, rol: persona.rol } });
  next();
};

export function contexto(req: Request): Contexto {
  const encontrado = contextos.get(req);
  if (!encontrado) {
    throw new Error('contexto() se usó en una ruta montada sin exigirSesion');
  }
  return encontrado;
}
