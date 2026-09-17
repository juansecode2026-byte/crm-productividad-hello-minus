import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sesionesDeLogs, sesionesDeMetricas, type SesionObservada } from './otlp.ts';

// Claude Code habla OTLP/HTTP directo: no hace falta un colector intermedio.
// Apuntándole OTEL_EXPORTER_OTLP_ENDPOINT acá, él mismo hace POST a
// .../v1/metrics y .../v1/logs, que es lo que se enruta abajo.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!).default,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function hashDeClave(clave: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function responder(estado: number, cuerpo: Record<string, unknown>): Response {
  return Response.json(cuerpo, { status: estado });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo se aceptan POST' });

  // OTEL_EXPORTER_OTLP_HEADERS mete la clave como cabecera arbitraria; se
  // acepta también Authorization: Bearer por si se configura así.
  const cabecera = req.headers.get('x-api-key') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!cabecera) return responder(401, { error: 'Falta la clave de ingesta' });

  const { data: clave, error: errorClave } = await supabase
    .from('claves_ingesta')
    .select('id, proyecto_id')
    .eq('hash_clave', await hashDeClave(cabecera))
    .eq('activa', true)
    .maybeSingle();
  if (errorClave) {
    console.error(`Buscando la clave [${errorClave.code}]: ${errorClave.message}`);
    return responder(500, { error: 'No se pudo validar la clave' });
  }
  if (!clave) return responder(401, { error: 'Clave inválida o revocada' });

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { error: 'El cuerpo no es JSON válido' });
  }

  // Claude Code postea a /v1/metrics y /v1/logs colgando del endpoint base.
  const ruta = new URL(req.url).pathname;
  const sesiones = ruta.endsWith('/v1/logs') ? sesionesDeLogs(cuerpo) : sesionesDeMetricas(cuerpo);
  if (sesiones.length === 0) return responder(200, { sesiones: 0 });

  const personasPorClave = await cargarPersonas();
  let conError = 0;

  for (const sesion of sesiones) {
    const { error } = await supabase.rpc('registrar_sesion_claude_code', {
      p_proyecto_id: clave.proyecto_id,
      p_session_id: sesion.session_id,
      p_visto_en: sesion.desde,
      p_persona_id: sesion.email ? (personasPorClave.get(sesion.email.toLowerCase()) ?? undefined) : undefined,
      p_prompts_nuevos: sesion.prompts_nuevos,
      p_duracion_segundos: sesion.duracion_segundos ?? undefined,
    });
    if (error) {
      console.error(`Registrando sesión ${sesion.session_id} [${error.code}]: ${error.message}`);
      conError++;
      continue;
    }
    // La ventana se cierra con el instante más tardío del lote.
    if (sesion.hasta !== sesion.desde) {
      await supabase.rpc('registrar_sesion_claude_code', {
        p_proyecto_id: clave.proyecto_id,
        p_session_id: sesion.session_id,
        p_visto_en: sesion.hasta,
      });
    }
  }

  await supabase.from('claves_ingesta').update({ ultimo_uso_en: new Date().toISOString() }).eq('id', clave.id);

  if (conError > 0) return responder(500, { sesiones: sesiones.length, con_error: conError });
  return responder(200, {
    sesiones: sesiones.length,
    sin_atribuir: sesiones.filter((s) => !s.email).length,
  });
});

async function cargarPersonas(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('personas').select('id, email');
  const mapa = new Map<string, string>();
  if (error) {
    console.error(`Leyendo personas [${error.code}]: ${error.message}`);
    return mapa;
  }
  for (const persona of data as { id: string; email: string }[]) {
    mapa.set(persona.email.toLowerCase(), persona.id);
  }
  return mapa;
}
