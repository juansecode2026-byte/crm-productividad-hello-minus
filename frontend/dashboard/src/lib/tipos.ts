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

// El veredicto del agente, de menos a más certeza. `null` no es un cuarto
// valor: significa que el agente nunca miró este ítem, que no es lo mismo que
// haberlo mirado y no encontrar nada. Ver db/migrations/013.
export type EstadoAgente = 'sin_empezar' | 'en_proceso' | 'hecho';

// Cuatro estados, no dos: `completado` lo marca una persona y es el único que
// cuenta para el porcentaje; los otros tres los escribe el agente al escanear
// y ninguno marca nada como terminado por sí solo.
export interface ChecklistItem {
  id: string;
  proyecto_id: string;
  etapa: number;
  texto: string;
  completado: boolean;
  completado_por: string | null;
  completado_en: string | null;
  estado_agente: EstadoAgente | null;
  verificado_en: string | null;
  evidencia: string | null;
  // Migración 016. La fecha es la mejor aproximación a cuándo se hizo lo que el
  // ítem describe; el origen dice qué tan confiable es. Van juntas o no van.
  evidencia_archivo: string | null;
  evidencia_fecha: string | null;
  evidencia_fecha_origen: OrigenFechaEvidencia | null;
}

export type OrigenFechaEvidencia = 'commit_archivo' | 'texto' | 'commit_claude_md';

export interface ResultadoEscaneo {
  sembrados: number;
  hechos: number;
  enProceso: number;
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

// `completado` lo declara la persona asignada (migración 014). No es una
// verificación: la evidencia real de haberla hecho vive aparte, en
// tarea_evidencia. Las dos señales juntas son lo que vale.
export interface TareaSemanal {
  id: string;
  proyecto_id: string;
  persona_id: string;
  semana_inicio: string;
  semana_fin: string;
  titulo: string;
  areas: string[];
  completado: boolean;
  completado_en: string | null;
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

// La clave en claro nunca vive acá: este tipo es lo que devuelve GET/revocar.
// POST /proyectos/:id/claves devuelve esto MÁS `clave` (una sola vez, ver
// clavesService.ts).
export interface ClaveIngesta {
  id: string;
  nombre: string;
  prefijo: string;
  activa: boolean;
  creada_en: string;
  ultimo_uso_en: string | null;
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
