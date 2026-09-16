import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  accionesDePullRequest,
  atribuidor,
  filaDePullRequest,
  filasDeCommits,
  type EventoPullRequest,
  type EventoPush,
  type PersonaParaAtribuir,
} from './eventos.ts';
import { firmaValida } from './firma.ts';

const secreto = Deno.env.get('GITHUB_WEBHOOK_SECRET');

// commits y pull_requests son tablas de solo-sistema: ningún usuario escribe
// ahí, así que la ingesta usa la llave secreta, que salta RLS.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!).default,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function responder(estado: number, cuerpo: Record<string, unknown>): Response {
  return Response.json(cuerpo, { status: estado });
}

// Un 5xx hace que GitHub marque la entrega como fallida y se pueda reenviar
// desde "Recent Deliveries" de la App.
function falloDeBase(contexto: string, error: { code?: string; message: string }): Response {
  console.error(`${contexto} [${error.code}]: ${error.message}`);
  return responder(500, { error: 'No se pudo guardar el evento' });
}

// En LIKE, "_" es comodín y los nombres de repo pueden tenerlo.
function patronExacto(nombre: string): string {
  return nombre.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo se aceptan POST' });

  if (!secreto) {
    console.error('Falta el secreto GITHUB_WEBHOOK_SECRET en Edge Functions > Secrets');
    return responder(500, { error: 'Receptor sin configurar' });
  }

  const cuerpo = new Uint8Array(await req.arrayBuffer());
  if (!(await firmaValida(cuerpo, req.headers.get('x-hub-signature-256'), secreto))) {
    return responder(401, { error: 'Firma inválida' });
  }

  let evento: unknown;
  try {
    evento = JSON.parse(new TextDecoder().decode(cuerpo));
  } catch {
    return responder(400, { error: 'El cuerpo no es JSON válido' });
  }

  const tipo = req.headers.get('x-github-event');
  if (tipo === 'ping') return responder(200, { pong: true });
  if (tipo !== 'push' && tipo !== 'pull_request') {
    return responder(202, { ignorado: `El evento ${tipo} no tiene tabla destino` });
  }

  const conRepo = evento as EventoPush | EventoPullRequest;
  if (tipo === 'pull_request' && !accionesDePullRequest.has((conRepo as EventoPullRequest).action)) {
    return responder(202, { ignorado: `Acción ${(conRepo as EventoPullRequest).action} sin cambios que guardar` });
  }

  const nombreRepo = conRepo.repository.full_name;
  const { data: repo, error: errorRepo } = await supabase
    .from('repositorios')
    .select('id, github_installation_id')
    .ilike('github_repo', patronExacto(nombreRepo))
    .maybeSingle();
  if (errorRepo) return falloDeBase('Buscando el repositorio', errorRepo);

  // Vincular un repo a un proyecto es decisión de una persona, no del receptor.
  if (!repo) {
    console.log(`Evento de un repositorio sin vincular: ${nombreRepo}`);
    return responder(202, { ignorado: 'Repositorio no vinculado a ningún proyecto' });
  }

  if (!repo.github_installation_id && conRepo.installation?.id) {
    const { error } = await supabase
      .from('repositorios')
      .update({ github_installation_id: conRepo.installation.id })
      .eq('id', repo.id);
    if (error) return falloDeBase('Guardando el installation id', error);
  }

  const { data: personas, error: errorPersonas } = await supabase
    .from('personas')
    .select('id, github_username, email');
  if (errorPersonas) return falloDeBase('Leyendo personas', errorPersonas);
  const atribuir = atribuidor(personas as PersonaParaAtribuir[]);

  if (tipo === 'push') {
    const filas = filasDeCommits(conRepo as EventoPush, repo.id, atribuir);
    if (filas.length > 0) {
      // El mismo commit llega varias veces (push a la rama y luego el merge):
      // la primera vez gana.
      const { error } = await supabase
        .from('commits')
        .upsert(filas, { onConflict: 'repo_id,sha', ignoreDuplicates: true });
      if (error) return falloDeBase('Guardando commits', error);
    }
    return responder(200, {
      commits_recibidos: filas.length,
      sin_atribuir: filas.filter((fila) => !fila.persona_id).length,
    });
  }

  const fila = filaDePullRequest(conRepo as EventoPullRequest, repo.id, atribuir);
  const { error } = await supabase.from('pull_requests').upsert(fila, { onConflict: 'repo_id,numero' });
  if (error) return falloDeBase('Guardando el pull request', error);

  return responder(200, { pull_request: fila.numero, atribuido: fila.persona_id !== null });
});
