import { supabase } from '../lib/supabaseClient';
import type { Proyecto } from '../lib/tipos';

const urlApi = import.meta.env.VITE_API_URL;

export async function listarProyectos(): Promise<Proyecto[]> {
  // Lectura directa a Supabase: RLS decide qué proyectos ve cada quien.
  const { data, error } = await supabase
    .from('proyectos')
    .select('id, nombre, descripcion, estado, modalidad, etapa_actual, encargado_id, prioridad, fecha_objetivo, alcance_congelado_en')
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data;
}

interface ErrorApi {
  error: { mensaje: string; detalles?: { campo: string; mensaje: string }[] };
}

async function peticionApi<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const respuesta = await fetch(`${urlApi}${ruta}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(cuerpo),
  });

  const json = (await respuesta.json()) as T | ErrorApi;
  if (!respuesta.ok) {
    const detalle = (json as ErrorApi).error;
    throw new Error(detalle.detalles?.map((d) => `${d.campo}: ${d.mensaje}`).join(', ') ?? detalle.mensaje);
  }
  return json as T;
}

export interface DatosNuevoProyecto {
  nombre: string;
  descripcion?: string;
  modalidad: 'individual' | 'equipo';
  encargado_id?: string;
}

export function crearProyecto(datos: DatosNuevoProyecto): Promise<Proyecto> {
  return peticionApi<Proyecto>('/proyectos', datos);
}
