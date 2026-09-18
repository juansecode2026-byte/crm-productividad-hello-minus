import { supabase } from '../lib/supabaseClient';

const urlApi = import.meta.env.VITE_API_URL;

interface ErrorApi {
  error: { mensaje: string; detalles?: { campo: string; mensaje: string }[] };
}

export async function peticionApi<T>(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: unknown,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const respuesta = await fetch(`${urlApi}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });

  // DELETE responde 204 sin cuerpo — no hay nada que parsear como JSON.
  if (respuesta.status === 204) return undefined as T;

  const json = (await respuesta.json()) as T | ErrorApi;
  if (!respuesta.ok) {
    const detalle = (json as ErrorApi).error;
    throw new Error(detalle.detalles?.map((d) => `${d.campo}: ${d.mensaje}`).join(', ') ?? detalle.mensaje);
  }
  return json as T;
}
