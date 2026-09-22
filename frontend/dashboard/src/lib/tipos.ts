// Provisionales: solo los campos que este dashboard usa hoy. Cuando el schema
// se toque seguido conviene generar el tipo completo con el MCP de Supabase
// (mismo que ya vive en backend/api/database.types.ts) y traerlo acá entero.

export interface Persona {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'lider_proyecto' | 'colaborador';
  github_username: string | null;
  activo: boolean;
}

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: 'activo' | 'pausado' | 'archivado';
  modalidad: 'individual' | 'equipo';
  etapa_actual: number;
  encargado_id: string | null;
  prioridad: number | null;
  fecha_inicio: string | null;
  fecha_objetivo: string | null;
  alcance_congelado_en: string | null;
}

export interface HistorialEtapa {
  etapa: number;
  entra_en: string;
  sale_en: string | null;
}

// Tres estados, no dos: `completado` lo marca una persona; `detectado_en` lo
// llena el agente al escanear y solo significa "creo que esto ya está hecho,
// confirmalo". Ver db/migrations/011.
export interface ChecklistItem {
  id: string;
  proyecto_id: string;
  etapa: number;
  texto: string;
  completado: boolean;
  completado_por: string | null;
  completado_en: string | null;
  detectado_en: string | null;
  evidencia: string | null;
}

export interface ResultadoEscaneo {
  sembrados: number;
  detectados: number;
  revisados: number;
  leyoClaudeMd: boolean;
}

export interface Hito {
  id: string;
  proyecto_id: string;
  nombre: string;
  etapa: number | null;
  fecha_planeada: string | null;
  fecha_real: string | null;
  estado: 'pendiente' | 'en_curso' | 'cumplido' | 'vencido';
}

export interface TareaEvidencia {
  id: string;
  tarea_id: string;
  area: string;
  fuente: 'commit' | 'pull_request' | 'sesion_claude_code';
  referencia: string;
  detectado_en: string;
}

export interface TareaSemanal {
  id: string;
  proyecto_id: string;
  persona_id: string;
  semana_inicio: string;
  semana_fin: string;
  titulo: string;
  areas: string[];
}

export interface Bloqueo {
  id: string;
  proyecto_id: string;
  persona_id: string;
  descripcion: string;
  tipo: 'interno' | 'externo' | 'cliente';
  abierto_en: string;
  resuelto_en: string | null;
  resuelto_por: string | null;
}

export interface RepoCandidato {
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
