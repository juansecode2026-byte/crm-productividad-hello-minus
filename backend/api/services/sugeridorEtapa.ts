// Puente entre los dos runtimes del backend: Express corre en Node y los
// agentes son Python (DECISIONES.md [D1]). Es el primer caso del proyecto en
// que Node llama a un agente **en caliente** —alguien apretó un botón y está
// esperando— y no por cron como el Clasificador de commits.
//
// Se eligió lanzar un proceso hijo en vez de levantar un servicio Python
// aparte porque esto se ejecuta un puñado de veces en la vida del sistema
// (una por proyecto que se vincula). La letra chica está en CLAUDE.md: asume
// que donde se despliegue el backend haya Python con las dependencias de
// `backend/agent/requirements.txt`. Hoy eso solo se cumple en local, y la
// fase de hosting sigue sin decidirse.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { ErrorHttp } from '../middleware/errores.js';
import { estadisticasRepo, estructuraRepo } from './github.js';

const ejecutar = promisify(execFile);

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CARPETA_AGENTES = path.resolve(AQUI, '../../agent');

// El agente piensa unos segundos; el límite es para que un cuelgue no deje la
// petición HTTP abierta para siempre, no para apurarlo.
const LIMITE_MS = 90_000;

export interface SugerenciaEtapa {
  etapa: number;
  evidencia: string;
  dudas: string | null;
}

interface RespuestaAgente {
  etapa?: number;
  evidencia?: string;
  dudas?: string | null;
  error?: string;
}

function binarioPython(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export async function sugerirEtapa(owner: string, repo: string): Promise<SugerenciaEtapa> {
  if (!config.ANTHROPIC_API_KEY) {
    throw new ErrorHttp(
      503,
      'Falta ANTHROPIC_API_KEY en el backend: sin eso el agente no puede sugerir la etapa. Elegila a mano.',
    );
  }

  // Las dos lecturas de GitHub son independientes entre sí; un repo privado
  // devuelve ambas en "no disponible" y el agente igual opina con lo que hay.
  const [estadisticas, estructura] = await Promise.all([
    estadisticasRepo(owner, repo),
    estructuraRepo(owner, repo),
  ]);

  const entrada = JSON.stringify({
    owner,
    repo,
    carpetas: estructura.carpetas,
    archivos_raiz: estructura.archivosRaiz,
    archivos_clave: estructura.archivosClave,
    total_archivos: estructura.totalArchivos,
    estructura_disponible: estructura.disponible,
    commits_total: estadisticas.commitsTotal,
    commits_truncado: estadisticas.commitsTruncado,
    commits_semana: estadisticas.commitsSemana,
    primer_commit: estadisticas.primerCommit,
    ultimo_commit: estadisticas.ultimoCommit,
    prs_abiertos: estadisticas.prsAbiertos,
    colaboradores: estadisticas.colaboradores,
  });

  let salida: string;
  try {
    const proceso = ejecutar(binarioPython(), ['-m', 'sugeridor_etapa.ejecutar'], {
      cwd: CARPETA_AGENTES,
      timeout: LIMITE_MS,
      maxBuffer: 1024 * 1024,
      // Hereda ANTHROPIC_API_KEY del entorno de la API — por eso la variable
      // vive en backend/api/.env aunque quien la use sea el proceso Python.
      env: process.env,
    });
    proceso.child.stdin?.end(entrada);
    salida = (await proceso).stdout;
  } catch (excepcion) {
    // El agente ya devuelve sus errores como JSON por stdout; si llegamos acá
    // el fallo es de más abajo: no hay Python, falta una dependencia, o se
    // pasó del límite de tiempo.
    const detalle = excepcion instanceof Error ? excepcion.message : String(excepcion);
    const salidaAgente = (excepcion as { stdout?: string }).stdout?.trim();
    if (salidaAgente) {
      try {
        const json = JSON.parse(salidaAgente) as RespuestaAgente;
        if (json.error) throw new ErrorHttp(502, json.error);
      } catch (error) {
        if (error instanceof ErrorHttp) throw error;
      }
    }
    console.error(`Sugeridor de etapa falló para ${owner}/${repo}: ${detalle}`);
    throw new ErrorHttp(502, 'No se pudo consultar al agente. Elegí la etapa a mano.');
  }

  let json: RespuestaAgente;
  try {
    json = JSON.parse(salida.trim()) as RespuestaAgente;
  } catch {
    throw new ErrorHttp(502, 'El agente devolvió algo que no se pudo leer. Elegí la etapa a mano.');
  }

  if (json.error) throw new ErrorHttp(502, json.error);
  if (typeof json.etapa !== 'number' || json.etapa < 1 || json.etapa > 9 || !json.evidencia) {
    throw new ErrorHttp(502, 'El agente respondió una etapa fuera de rango. Elegí la etapa a mano.');
  }

  return { etapa: json.etapa, evidencia: json.evidencia, dudas: json.dudas ?? null };
}
