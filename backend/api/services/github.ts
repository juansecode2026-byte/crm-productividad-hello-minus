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

// Lo que el Sugeridor de etapa necesita ver para opinar: en qué está dividido
// el proyecto, no cuánto código tiene. Resumen, no el árbol entero — un repo
// grande tiene miles de archivos y ninguno de ellos cambia el veredicto.
export interface EstructuraRepo {
  disponible: boolean;
  carpetas: string[];
  archivosRaiz: string[];
  // Archivos que delatan en qué etapa está el proyecto, a cualquier
  // profundidad: en un repo con backend/ y frontend/ separados, el
  // package.json que prueba que la app corre no está en la raíz.
  archivosClave: string[];
  totalArchivos: number;
  truncado: boolean;
}

interface CommitApi {
  commit: { author: { name: string; date: string } | null };
  author: { login: string } | null;
}

interface ArbolApi {
  tree: { path: string; type: 'blob' | 'tree' }[];
  truncated: boolean;
}

// Tope de lo que se le manda al agente. Empezó en 12.000 y se subió el
// 2026-09-22 después de una prueba real: con ese corte, el CLAUDE.md de este
// propio repo (28 KB) llegaba al 43%, y la sección que declaraba "probado
// contra datos reales" quedaba afuera — el agente respondió que esa
// declaración no existía. Tenía razón sobre lo que vio; el problema era el
// recorte. Cortar a la mitad justo la señal más explícita anula el motivo de
// leer el archivo.
//
// 40.000 caracteres son ~10k tokens. Como esto lo dispara una persona un
// puñado de veces por proyecto, el costo no es la restricción.
const MAX_CLAUDE_MD = 40_000;

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

const PROFUNDIDAD_MAXIMA = 2; // Más abajo ya es detalle de implementación, no estructura.
const MAX_ARCHIVOS_CLAVE = 40;

// Cada patrón responde una pregunta concreta de las que separan una etapa de
// la siguiente: ¿el proyecto corre? ¿tiene pruebas? ¿se despliega? ¿lleva
// agentes de IA? Un archivo que no responda ninguna de esas no entra: el
// agente no necesita ver 95 archivos para decidir.
const PATRONES_CLAVE: RegExp[] = [
  /(^|\/)package\.json$/i, //            ¿corre? (etapa 3)
  /(^|\/)requirements\.txt$/i,
  /(^|\/)pyproject\.toml$/i,
  /(^|\/)(vite|next|webpack|rollup)\.config\.[cm]?[jt]s$/i,
  /(^|\/)tsconfig.*\.json$/i,
  /(^|\/)(test|tests|__tests__|spec)\//i, //  ¿tiene pruebas? (etapa 7)
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  /(^|\/)(pytest\.ini|jest\.config\.[cm]?[jt]s|vitest\.config\.[cm]?[jt]s)$/i,
  /(^|\/)\.github\/workflows\//i, //      ¿CI/CD? (etapas 7-8)
  /(^|\/)(Dockerfile|docker-compose\.ya?ml|Procfile|vercel\.json|netlify\.toml|fly\.toml|render\.yaml)$/i,
  /(^|\/)(agent|agents|agentes|agentes-sdk|prompts?)\//i, // ¿lleva IA? (etapa 5)
  /(^|\/)(system_prompt|prompt)\.(md|txt)$/i,
  /(^|\/)(migrations?|migraciones)\//i, // ¿hay esquema de datos? (etapa 2)
  /\.sql$/i,
];

// El árbol recursivo viene en una sola petición (`HEAD` sirve como ref, así no
// hay que pedir antes el default_branch). Se resume a carpetas de hasta dos
// niveles y archivos de la raíz: alcanza para distinguir "tiene backend y
// frontend" de "tiene además tests y workflows", que es lo que decide la etapa.
export async function estructuraRepo(owner: string, repo: string): Promise<EstructuraRepo> {
  const arbol = await api<ArbolApi>(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);

  if (!arbol) {
    return {
      disponible: false,
      carpetas: [],
      archivosRaiz: [],
      archivosClave: [],
      totalArchivos: 0,
      truncado: false,
    };
  }

  const carpetas = new Set<string>();
  const archivosRaiz: string[] = [];
  const archivosClave: string[] = [];
  let totalArchivos = 0;

  for (const entrada of arbol.tree) {
    const partes = entrada.path.split('/');
    if (entrada.type === 'tree') {
      if (partes.length <= PROFUNDIDAD_MAXIMA) carpetas.add(entrada.path);
      continue;
    }

    totalArchivos++;
    if (partes.length === 1) archivosRaiz.push(entrada.path);
    if (archivosClave.length < MAX_ARCHIVOS_CLAVE && PATRONES_CLAVE.some((patron) => patron.test(entrada.path))) {
      archivosClave.push(entrada.path);
    }
  }

  return {
    disponible: true,
    carpetas: [...carpetas].sort(),
    archivosRaiz: archivosRaiz.sort(),
    archivosClave: archivosClave.sort(),
    totalArchivos,
    truncado: arbol.truncated,
  };
}

// La señal más directa que existe, cuando existe: un CLAUDE.md al día declara
// en texto qué está construido, en vez de obligar a deducirlo de la forma de
// las carpetas. Es opcional a propósito — la mayoría de los repos no lo tiene,
// y el agente tiene que seguir funcionando igual sin él.
export async function leerClaudeMd(owner: string, repo: string): Promise<string | null> {
  const archivo = await api<{ content?: string; encoding?: string }>(
    `/repos/${owner}/${repo}/contents/CLAUDE.md`,
  );
  if (!archivo?.content || archivo.encoding !== 'base64') return null;

  const texto = Buffer.from(archivo.content, 'base64').toString('utf-8');
  return texto.length > MAX_CLAUDE_MD ? `${texto.slice(0, MAX_CLAUDE_MD)}\n\n[...recortado]` : texto;
}
