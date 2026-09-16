// Lector de la API pública de GitHub — sin App ni token: los 4 repos candidatos
// son públicos. Ver DECISIONES.md y NOTAS.md 2026-09-15/16 sobre por qué no se
// copian los repos de Gabriel en vez de leerlos así.
//
// Límite real: 60 peticiones/hora sin autenticar, por IP. Con GITHUB_TOKEN
// (opcional, nunca requerido) sube a 5000/hora — se agrega solo si existe.
import { config } from '../config.js';

const CABECERAS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'crm-productividad-hello-minus',
};
if (config.GITHUB_TOKEN) CABECERAS.Authorization = `Bearer ${config.GITHUB_TOKEN}`;

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export interface EstadisticasRepo {
  owner: string;
  repo: string;
  disponible: boolean;
  ultimoCommit: string | null;
  primerCommit: string | null;
  commitsSemana: number;
  commitsTotal: number;
  commitsTruncado: boolean;
  prsAbiertos: number;
  colaboradores: string[];
}

interface CommitApi {
  commit: { author: { name: string; date: string } | null };
  author: { login: string } | null;
}

async function api<T>(ruta: string): Promise<T | null> {
  const respuesta = await fetch(`https://api.github.com${ruta}`, { headers: CABECERAS });
  if (!respuesta.ok) return null;
  return (await respuesta.json()) as T;
}

// GitHub solo pagina hacia atrás en el tiempo: sin recorrer todo el historial no
// hay forma barata de saber el commit más viejo de un repo grande. Con 100 alcanza
// para los 4 candidatos de hoy (el más largo tiene 66); si algún día se agrega un
// repo más viejo, primerCommit sale null en vez de un dato falso.
export async function estadisticasRepo(owner: string, repo: string): Promise<EstadisticasRepo> {
  const base = { owner, repo };

  const [commits, prs] = await Promise.all([
    api<CommitApi[]>(`/repos/${owner}/${repo}/commits?per_page=100`),
    api<unknown[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`),
  ]);

  if (!commits) {
    return {
      ...base,
      disponible: false,
      ultimoCommit: null,
      primerCommit: null,
      commitsSemana: 0,
      commitsTotal: 0,
      commitsTruncado: false,
      prsAbiertos: 0,
      colaboradores: [],
    };
  }

  const haceUnaSemana = Date.now() - SIETE_DIAS_MS;
  const colaboradores = new Set<string>();
  let commitsSemana = 0;

  for (const commit of commits) {
    const nombre = commit.author?.login ?? commit.commit.author?.name;
    if (nombre) colaboradores.add(nombre);
    const fecha = commit.commit.author?.date;
    if (fecha && new Date(fecha).getTime() >= haceUnaSemana) commitsSemana++;
  }

  return {
    ...base,
    disponible: true,
    ultimoCommit: commits[0]?.commit.author?.date ?? null,
    primerCommit: commits.length < 100 ? (commits[commits.length - 1]?.commit.author?.date ?? null) : null,
    commitsSemana,
    commitsTotal: commits.length,
    commitsTruncado: commits.length === 100,
    prsAbiertos: prs?.length ?? 0,
    colaboradores: [...colaboradores],
  };
}
