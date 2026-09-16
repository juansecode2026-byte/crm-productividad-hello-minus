import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { hashDeClave } from './clave.ts';
import {
  atribuidor,
  filasDeSesiones,
  filasDeTrazas,
  TIPOS,
  type PersonaParaAtribuir,
  type TipoEvento,
} from './eventos.ts';

// trazas_agente y sesiones_claude_code son tablas de solo-sistema: la ingesta
// escribe con la llave secreta, que salta RLS. La autorización real es la
// clave del proyecto, que se valida abajo.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!).default,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function responder(estado: number, cuerpo: Record<string, unknown>): Response {
  return Response.json(cuerpo, { status: estado });
}

function falloDeBase(contexto: string, error: { code?: string; message: string }): Response {
  console.error(`${contexto} [${error.code}]: ${error.message}`);
  return responder(500, { error: 'No se pudo guardar la telemetría' });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo se aceptan POST' });

  const claveEnviada = req.headers.get('x-api-key');
  if (!claveEnviada) return responder(401, { error: 'Falta la cabecera X-API-Key' });

  const { data: clave, error: errorClave } = await supabase
    .from('claves_ingesta')
    .select('id, proyecto_id')
    .eq('hash_clave', await hashDeClave(claveEnviada))
    .eq('activa', true)
    .maybeSingle();
  if (errorClave) return falloDeBase('Buscando la clave', errorClave);
  if (!clave) return responder(401, { error: 'Clave inválida o revocada' });

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { error: 'El cuerpo no es JSON válido' });
  }

  const { tipo, eventos } = (cuerpo ?? {}) as { tipo?: string; eventos?: unknown };
  if (!tipo || !TIPOS.includes(tipo as TipoEvento)) {
    return responder(400, { error: `"tipo" tiene que ser uno de: ${TIPOS.join(', ')}` });
  }

  if (tipo === 'traza_agente') {
    const resultado = filasDeTrazas(eventos, clave.proyecto_id);
    if ('error' in resultado) return responder(400, { error: resultado.error });

    const { error } = await supabase.from('trazas_agente').insert(resultado.filas);
    if (error) return falloDeBase('Guardando trazas', error);

    await marcarUso(clave.id);
    return responder(200, { guardados: resultado.filas.length });
  }

  const { data: personas, error: errorPersonas } = await supabase
    .from('personas')
    .select('id, email, github_username');
  if (errorPersonas) return falloDeBase('Leyendo personas', errorPersonas);

  const resultado = filasDeSesiones(eventos, clave.proyecto_id, atribuidor(personas as PersonaParaAtribuir[]));
  if ('error' in resultado) return responder(400, { error: resultado.error });

  // Una sesión se reporta varias veces mientras avanza (crece prompt_count,
  // al final llega `fin`): la última gana.
  const { error } = await supabase
    .from('sesiones_claude_code')
    .upsert(resultado.filas, { onConflict: 'session_id' });
  if (error) return falloDeBase('Guardando sesiones', error);

  await marcarUso(clave.id);
  return responder(200, {
    guardados: resultado.filas.length,
    sin_atribuir: resultado.filas.filter((fila) => !fila.persona_id).length,
  });
});

async function marcarUso(claveId: string): Promise<void> {
  const { error } = await supabase
    .from('claves_ingesta')
    .update({ ultimo_uso_en: new Date().toISOString() })
    .eq('id', claveId);
  // No se le falla la petición al proyecto por no poder sellar la fecha de uso.
  if (error) console.error(`Marcando último uso [${error.code}]: ${error.message}`);
}
