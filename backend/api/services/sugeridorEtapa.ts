// Sugeridor de etapa: lee el repositorio y propone en cuál de las 9 etapas
// está el proyecto. Lo dispara el botón "Sugerir con agente IA" al vincular.
//
// El manejo del proceso Python vive en `agentePython.ts`, compartido con el
// Verificador de checklist.
import { ErrorHttp } from '../middleware/errores.js';
import { correrAgente } from './agentePython.js';
import { estadisticasRepo, estructuraRepo } from './github.js';

export interface SugerenciaEtapa {
  etapa: number;
  evidencia: string;
  dudas: string | null;
}

export async function sugerirEtapa(owner: string, repo: string): Promise<SugerenciaEtapa> {
  // Las dos lecturas de GitHub son independientes entre sí; un repo privado
  // devuelve ambas en "no disponible" y el agente igual opina con lo que hay.
  const [estadisticas, estructura] = await Promise.all([
    estadisticasRepo(owner, repo),
    estructuraRepo(owner, repo),
  ]);

  const json = await correrAgente<Partial<SugerenciaEtapa>>({
    modulo: 'sugeridor_etapa.ejecutar',
    contexto: `${owner}/${repo}`,
    entrada: {
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
    },
  });

  if (typeof json.etapa !== 'number' || json.etapa < 1 || json.etapa > 9 || !json.evidencia) {
    throw new ErrorHttp(502, 'El agente respondió una etapa fuera de rango. Elegí la etapa a mano.');
  }

  return { etapa: json.etapa, evidencia: json.evidencia, dudas: json.dudas ?? null };
}
