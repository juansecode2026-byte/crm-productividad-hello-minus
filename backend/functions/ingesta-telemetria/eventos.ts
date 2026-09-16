// Validación y traducción de los eventos que empujan los proyectos.
// Pura a propósito: se prueba con Node sin desplegar ni tocar la base.

export const TIPOS = ['traza_agente', 'sesion_claude_code'] as const;
export type TipoEvento = (typeof TIPOS)[number];

// Un push puede traer varios eventos, pero no ilimitados: es un endpoint
// público con clave, no un bulk loader.
export const MAX_EVENTOS = 500;

export interface FilaTraza {
  proyecto_id: string;
  run_id: string;
  agent_id: string | null;
  agent_type: string | null;
  environment: string | null;
  iteration_index: number | null;
  node_name: string | null;
  tool_name: string | null;
  args_hash: string | null;
  tokens: number | null;
  duration_ms: number | null;
  status: string | null;
}

export interface FilaSesion {
  proyecto_id: string;
  persona_id: string | null;
  session_id: string;
  prompt_count: number;
  inicio: string;
  fin: string | null;
  duracion_activa: string | null;
  archivos_tocados: string[];
}

export type Resultado<T> = { filas: T[] } | { error: string };

export interface PersonaParaAtribuir {
  id: string;
  email: string;
  github_username: string | null;
}

// El proyecto no conoce los uuid del CRM: manda un email o un usuario de
// GitHub y acá se traduce. Sin distinguir mayúsculas, como en los commits.
export function atribuidor(personas: PersonaParaAtribuir[]) {
  const porClave = new Map<string, string>();
  for (const persona of personas) {
    porClave.set(persona.email.toLowerCase(), persona.id);
    if (persona.github_username) porClave.set(persona.github_username.toLowerCase(), persona.id);
  }
  return (clave: string | null) => (clave ? (porClave.get(clave.toLowerCase()) ?? null) : null);
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function entero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : null;
}

function listaDeTextos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((v): v is string => typeof v === 'string');
}

// Se acepta cualquier fecha que JS sepa parsear y se guarda en ISO, para que
// un proyecto no tenga que adivinar el formato exacto de Postgres.
function fecha(valor: unknown): string | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const fechaParseada = new Date(bruto);
  return Number.isNaN(fechaParseada.getTime()) ? null : fechaParseada.toISOString();
}

function validarLote(eventos: unknown): string | null {
  if (!Array.isArray(eventos)) return 'El campo "eventos" tiene que ser una lista';
  if (eventos.length === 0) return 'No llegó ningún evento';
  if (eventos.length > MAX_EVENTOS) return `Máximo ${MAX_EVENTOS} eventos por petición, llegaron ${eventos.length}`;
  return null;
}

export function filasDeTrazas(eventos: unknown, proyectoId: string): Resultado<FilaTraza> {
  const problema = validarLote(eventos);
  if (problema) return { error: problema };

  const filas: FilaTraza[] = [];
  for (const [indice, evento] of (eventos as unknown[]).entries()) {
    if (!esObjeto(evento)) return { error: `El evento ${indice} no es un objeto` };

    const runId = texto(evento.run_id);
    if (!runId) return { error: `El evento ${indice} no trae run_id` };

    filas.push({
      // Del proyecto dueño de la clave, nunca del cuerpo: una clave no puede
      // escribir telemetría de otro proyecto.
      proyecto_id: proyectoId,
      run_id: runId,
      agent_id: texto(evento.agent_id),
      agent_type: texto(evento.agent_type),
      environment: texto(evento.environment),
      iteration_index: entero(evento.iteration_index),
      node_name: texto(evento.node_name),
      tool_name: texto(evento.tool_name),
      args_hash: texto(evento.args_hash),
      tokens: entero(evento.tokens),
      duration_ms: entero(evento.duration_ms),
      status: texto(evento.status),
    });
  }
  return { filas };
}

export function filasDeSesiones(
  eventos: unknown,
  proyectoId: string,
  resolverPersona: (clave: string | null) => string | null,
): Resultado<FilaSesion> {
  const problema = validarLote(eventos);
  if (problema) return { error: problema };

  const filas: FilaSesion[] = [];
  for (const [indice, evento] of (eventos as unknown[]).entries()) {
    if (!esObjeto(evento)) return { error: `El evento ${indice} no es un objeto` };

    const sessionId = texto(evento.session_id);
    if (!sessionId) return { error: `El evento ${indice} no trae session_id` };

    const inicio = fecha(evento.inicio);
    if (!inicio) return { error: `El evento ${indice} no trae un inicio válido` };

    const segundos = entero(evento.duracion_activa_segundos);

    filas.push({
      proyecto_id: proyectoId,
      // Sin coincidencia queda huérfana, igual que un commit sin autor
      // conocido: el dato entra, la atribución se arregla después.
      persona_id: resolverPersona(texto(evento.persona)),
      session_id: sessionId,
      prompt_count: entero(evento.prompt_count) ?? 0,
      inicio,
      fin: fecha(evento.fin),
      duracion_activa: segundos === null ? null : `${segundos} seconds`,
      archivos_tocados: listaDeTextos(evento.archivos_tocados),
    });
  }
  return { filas };
}
