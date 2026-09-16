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
