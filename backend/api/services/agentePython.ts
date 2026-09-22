// Lanzador común de los agentes Python. Express corre en Node y los agentes
// son Python (DECISIONES.md [D1]); los que se invocan en caliente —con una
// persona esperando en pantalla— se lanzan como proceso hijo y hablan por
// stdin/stdout en JSON.
//
// Se extrajo acá cuando apareció el segundo agente de este tipo (Verificador
// de checklist, después del Sugeridor de etapa): son ~40 líneas de manejo de
// proceso y de errores que no tienen por qué estar dos veces.
//
// Letra chica, documentada también en CLAUDE.md: asume que donde se despliegue
// el backend haya Python con `backend/agent/requirements.txt` instalado. Hoy
// eso solo se cumple en local y la fase de hosting sigue sin decidirse.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { ErrorHttp } from '../middleware/errores.js';

const ejecutar = promisify(execFile);

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CARPETA_AGENTES = path.resolve(AQUI, '../../agent');

function binarioPython(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function exigirClaveAnthropic(): void {
  if (!config.ANTHROPIC_API_KEY) {
    throw new ErrorHttp(
      503,
      'Falta ANTHROPIC_API_KEY en el backend: sin eso los agentes no pueden responder.',
    );
  }
}

interface OpcionesAgente {
  /** Módulo Python a ejecutar, ej. `verificador_checklist.ejecutar`. */
  modulo: string;
  /** Lo que se le manda por stdin. Se serializa acá. */
  entrada: unknown;
  /** Para el log cuando algo falla: qué se estaba consultando. */
  contexto: string;
  /** El agente piensa unos segundos; esto es para que un cuelgue no deje la petición abierta. */
  limiteMs?: number;
}

/**
 * Lanza un agente Python y devuelve su JSON ya parseado.
 *
 * Los agentes devuelven sus propios errores como `{ error }` por stdout; si el
 * fallo llega por excepción, es de más abajo (no hay Python, falta una
 * dependencia, o se pasó del tiempo límite).
 */
export async function correrAgente<T>({
  modulo,
  entrada,
  contexto,
  limiteMs = 90_000,
}: OpcionesAgente): Promise<T> {
  exigirClaveAnthropic();

  let salida: string;
  try {
    const proceso = ejecutar(binarioPython(), ['-m', modulo], {
      cwd: CARPETA_AGENTES,
      timeout: limiteMs,
      maxBuffer: 4 * 1024 * 1024,
      // Hereda ANTHROPIC_API_KEY del entorno de la API — por eso la variable
      // vive en backend/api/.env aunque quien la use sea el proceso Python.
      env: process.env,
    });
    proceso.child.stdin?.end(JSON.stringify(entrada));
    salida = (await proceso).stdout;
  } catch (excepcion) {
    const salidaAgente = (excepcion as { stdout?: string }).stdout?.trim();
    if (salidaAgente) {
      try {
        const json = JSON.parse(salidaAgente) as { error?: string };
        if (json.error) throw new ErrorHttp(502, json.error);
      } catch (error) {
        if (error instanceof ErrorHttp) throw error;
      }
    }
    const detalle = excepcion instanceof Error ? excepcion.message : String(excepcion);
    console.error(`Agente ${modulo} falló (${contexto}): ${detalle}`);
    throw new ErrorHttp(502, 'No se pudo consultar al agente. Intentá de nuevo en un momento.');
  }

  let json: T & { error?: string };
  try {
    json = JSON.parse(salida.trim()) as T & { error?: string };
  } catch {
    throw new ErrorHttp(502, 'El agente devolvió algo que no se pudo leer.');
  }

  if (json.error) throw new ErrorHttp(502, json.error);
  return json;
}
