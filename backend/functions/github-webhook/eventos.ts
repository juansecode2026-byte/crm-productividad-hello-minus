export interface PersonaParaAtribuir {
  id: string;
  github_username: string | null;
  email: string;
}

export type Atribuir = (usuario: string | null | undefined, email: string | null | undefined) => string | null;

// Los usuarios de GitHub no distinguen mayúsculas ("Monkeyotbz" = "monkeyotbz").
// El email es respaldo: en un push, author.username solo viene si GitHub
// reconoce el email del commit como de una cuenta.
export function atribuidor(personas: PersonaParaAtribuir[]): Atribuir {
  const porUsuario = new Map<string, string>();
  const porEmail = new Map<string, string>();
  for (const persona of personas) {
    if (persona.github_username) porUsuario.set(persona.github_username.toLowerCase(), persona.id);
    porEmail.set(persona.email.toLowerCase(), persona.id);
  }
  return (usuario, email) =>
    (usuario && porUsuario.get(usuario.toLowerCase())) || (email && porEmail.get(email.toLowerCase())) || null;
}

interface RepositorioDelEvento {
  full_name: string;
}

interface InstalacionDelEvento {
  id: number;
}

interface CommitDelPush {
  id: string;
  message: string;
  timestamp: string;
  author: { name: string; email: string | null; username?: string };
  added: string[];
  removed: string[];
  modified: string[];
}

export interface EventoPush {
  repository: RepositorioDelEvento;
  installation?: InstalacionDelEvento;
  commits: CommitDelPush[];
}

export interface EventoPullRequest {
  action: string;
  repository: RepositorioDelEvento;
  installation?: InstalacionDelEvento;
  pull_request: {
    number: number;
    title: string;
    created_at: string;
    merged_at: string | null;
    user: { login: string };
  };
}

export interface FilaCommit {
  repo_id: string;
  sha: string;
  mensaje: string;
  archivos_tocados: string[];
  fecha: string;
  persona_id: string | null;
}

export interface FilaPullRequest {
  repo_id: string;
  numero: number;
  titulo: string;
  abierto_en: string;
  mergeado_en: string | null;
  persona_id: string | null;
}

// area_inferida y tipo_inferido no se tocan: los llena el Clasificador de
// commits en la cadena nocturna.
export function filasDeCommits(evento: EventoPush, repoId: string, atribuir: Atribuir): FilaCommit[] {
  return evento.commits.map((commit) => ({
    repo_id: repoId,
    sha: commit.id,
    mensaje: commit.message,
    archivos_tocados: [...new Set([...commit.added, ...commit.removed, ...commit.modified])],
    fecha: commit.timestamp,
    persona_id: atribuir(commit.author.username, commit.author.email),
  }));
}

// Las acciones que cambian algo que guardamos. labeled, assigned, etc. no.
export const accionesDePullRequest = new Set(['opened', 'reopened', 'edited', 'closed', 'synchronize']);

// El payload no trae la lista de archivos del PR: hace falta la API de GitHub,
// así que archivos_tocados queda para el sincronizador con credenciales de App.
export function filaDePullRequest(evento: EventoPullRequest, repoId: string, atribuir: Atribuir): FilaPullRequest {
  const pr = evento.pull_request;
  return {
    repo_id: repoId,
    numero: pr.number,
    titulo: pr.title,
    abierto_en: pr.created_at,
    mergeado_en: pr.merged_at,
    persona_id: atribuir(pr.user.login, null),
  };
}
