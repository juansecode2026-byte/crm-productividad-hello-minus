// Parseo de OTLP/JSON, el formato que exporta Claude Code con
// CLAUDE_CODE_ENABLE_TELEMETRY=1 y OTEL_EXPORTER_OTLP_PROTOCOL=http/json.
//
// Solo se lee lo que alimenta `sesiones_claude_code`. El resto de las métricas
// (costo, tokens, líneas, commits) se ignora a propósito: hoy no hay columna
// donde ponerlas y no se inventa esquema por el camino.
//
// Puro a propósito: se prueba con Node, sin desplegar.

const METRICA_TIEMPO_ACTIVO = 'claude_code.active_time.total';
const EVENTO_PROMPT = 'claude_code.user_prompt';

export interface SesionObservada {
  session_id: string;
  email: string | null;
  /** El instante más temprano visto en este lote. */
  desde: string;
  /** El más tardío. */
  hasta: string;
  /** Acumulativo de OTel: el mayor gana. */
  duracion_segundos: number | null;
  /** Solo los de ESTE lote: se suman en la base. */
  prompts_nuevos: number;
}

interface ValorAtributo {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
}

interface Atributo {
  key?: string;
  value?: ValorAtributo;
}

function aTexto(valor: ValorAtributo | undefined): string | null {
  if (!valor) return null;
  if (typeof valor.stringValue === 'string') return valor.stringValue;
  if (valor.intValue !== undefined) return String(valor.intValue);
  if (valor.doubleValue !== undefined) return String(valor.doubleValue);
  return null;
}

function mapaDeAtributos(atributos: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  if (!Array.isArray(atributos)) return mapa;
  for (const atributo of atributos as Atributo[]) {
    if (!atributo?.key) continue;
    const texto = aTexto(atributo.value);
    if (texto !== null) mapa.set(atributo.key, texto);
  }
  return mapa;
}

// OTLP manda nanosegundos como string para no perder precisión en JSON.
function aIso(nano: unknown): string | null {
  if (nano === undefined || nano === null) return null;
  const ms = Number(BigInt(String(nano)) / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

function numeroDePunto(punto: Record<string, unknown>): number | null {
  if (punto.asDouble !== undefined) return Number(punto.asDouble);
  if (punto.asInt !== undefined) return Number(punto.asInt);
  return null;
}

class Acumulador {
  private sesiones = new Map<string, SesionObservada>();

  observar(sessionId: string, momento: string | null, atributos: Map<string, string>): SesionObservada {
    const existente = this.sesiones.get(sessionId);
    const instante = momento ?? new Date().toISOString();
    const email = atributos.get('user.email') ?? null;

    if (!existente) {
      const nueva: SesionObservada = {
        session_id: sessionId,
        email,
        desde: instante,
        hasta: instante,
        duracion_segundos: null,
        prompts_nuevos: 0,
      };
      this.sesiones.set(sessionId, nueva);
      return nueva;
    }

    if (instante < existente.desde) existente.desde = instante;
    if (instante > existente.hasta) existente.hasta = instante;
    if (!existente.email && email) existente.email = email;
    return existente;
  }

  resultado(): SesionObservada[] {
    return [...this.sesiones.values()];
  }
}

/** Métricas: de acá sale la ventana de la sesión y el tiempo activo. */
export function sesionesDeMetricas(cuerpo: unknown): SesionObservada[] {
  const acumulador = new Acumulador();
  const recursos = (cuerpo as { resourceMetrics?: unknown[] })?.resourceMetrics;
  if (!Array.isArray(recursos)) return [];

  for (const recurso of recursos) {
    const atributosRecurso = mapaDeAtributos((recurso as { resource?: { attributes?: unknown } })?.resource?.attributes);

    for (const alcance of (recurso as { scopeMetrics?: unknown[] }).scopeMetrics ?? []) {
      for (const metrica of (alcance as { metrics?: unknown[] }).metrics ?? []) {
        const nombre = (metrica as { name?: string }).name;
        const puntos =
          (metrica as { sum?: { dataPoints?: unknown[] }; gauge?: { dataPoints?: unknown[] } }).sum?.dataPoints ??
          (metrica as { gauge?: { dataPoints?: unknown[] } }).gauge?.dataPoints ??
          [];

        for (const punto of puntos as Record<string, unknown>[]) {
          const atributos = new Map([...atributosRecurso, ...mapaDeAtributos(punto.attributes)]);
          const sessionId = atributos.get('session.id');
          if (!sessionId) continue;

          const sesion = acumulador.observar(sessionId, aIso(punto.timeUnixNano), atributos);

          const inicioPunto = aIso(punto.startTimeUnixNano);
          if (inicioPunto && inicioPunto < sesion.desde) sesion.desde = inicioPunto;

          if (nombre === METRICA_TIEMPO_ACTIVO) {
            const segundos = numeroDePunto(punto);
            if (segundos !== null && (sesion.duracion_segundos === null || segundos > sesion.duracion_segundos)) {
              sesion.duracion_segundos = Math.round(segundos);
            }
          }
        }
      }
    }
  }
  return acumulador.resultado();
}

/** Logs: de acá sale cuántos prompts mandó la persona en este lote. */
export function sesionesDeLogs(cuerpo: unknown): SesionObservada[] {
  const acumulador = new Acumulador();
  const recursos = (cuerpo as { resourceLogs?: unknown[] })?.resourceLogs;
  if (!Array.isArray(recursos)) return [];

  for (const recurso of recursos) {
    const atributosRecurso = mapaDeAtributos((recurso as { resource?: { attributes?: unknown } })?.resource?.attributes);

    for (const alcance of (recurso as { scopeLogs?: unknown[] }).scopeLogs ?? []) {
      for (const registro of (alcance as { logRecords?: unknown[] }).logRecords ?? []) {
        const fila = registro as Record<string, unknown>;
        const atributos = new Map([...atributosRecurso, ...mapaDeAtributos(fila.attributes)]);
        const sessionId = atributos.get('session.id');
        if (!sessionId) continue;

        const sesion = acumulador.observar(sessionId, aIso(fila.timeUnixNano), atributos);

        // El nombre del evento viaja en el body o en un atributo, según versión.
        const nombre = aTexto(fila.body as ValorAtributo) ?? atributos.get('event.name');
        if (nombre === EVENTO_PROMPT) sesion.prompts_nuevos++;
      }
    }
  }
  return acumulador.resultado();
}
