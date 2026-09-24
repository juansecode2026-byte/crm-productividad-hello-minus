// Catálogo de indicadores: lo que vive en la base (indicador_catalogo +
// indicador_aplicabilidad, migración 015) más dos cosas que se derivan acá.
//
// 1. El GRUPO (A/B/C/Nuevo) no se guarda en ninguna columna: sale de la
//    aplicabilidad. Guardarlo además sería tener el mismo dato dos veces, y el
//    día que alguien edite uno solo se contradicen.
//
// 2. La FUENTE es un hecho del esquema, no de los datos — mismo criterio que
//    etapas.ts y agentes.ts: cambia cuando cambia el esquema, no por hora.
//    Regla usada para clasificar cada uno: se mide lo que el doc DEFINE, no un
//    sustituto. Si el doc dice "% de tiempo", un proxy con commits sería otro
//    indicador con el mismo nombre, así que va como ◐ (espera registro_tiempo)
//    aunque haya commits.
//
//    ✓ respaldo    el esquema tiene la tabla y el campo que lo alimenta
//    ◐ telemetría  la tabla existe, pero se llena con telemetría de Claude
//                  Code que todavía no está encendida
//    ○ sin campo   ningún campo del esquema lo respalda: falta capturar un dato
//
// Esto NO dice si hoy hay filas: eso lo dice indicador_snapshots.

export type Fuente = 'respaldo' | 'telemetria' | 'sin_campo';
export type Grupo = 'A' | 'B' | 'C' | 'Nuevo';
export type Modalidad = 'individual' | 'equipo';

export interface IndicadorCatalogo {
  indicador_code: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
}

export interface Aplicabilidad {
  indicador_code: string;
  modalidad: Modalidad;
  aplica: boolean;
  sustituye_comparacion: string | null;
}

// Orden en que se muestran las categorías — el del doc de indicadores.
export const CATEGORIAS = ['Productividad', 'Efectividad', 'Carga y Bienestar', 'Eficiencia', 'Riesgo'] as const;

export const FUENTE: Record<string, { fuente: Fuente; tabla: string }> = {
  '01_throughput':                    { fuente: 'respaldo',   tabla: 'tareas_semanales.completado_en' },
  '02_ratio_facturable':              { fuente: 'telemetria', tabla: 'registro_tiempo.tipo' },
  '03_precision_estimacion':          { fuente: 'sin_campo',  tabla: 'no hay estimación por tarea' },
  '04_tiempo_primer_avance':          { fuente: 'respaldo',   tabla: 'tareas_semanales + tarea_evidencia' },
  '05_dispersion':                    { fuente: 'telemetria', tabla: 'registro_tiempo' },
  '06_carga_vs_capacidad':            { fuente: 'sin_campo',  tabla: 'no hay capacidad por persona' },
  '07_continuidad_foco':              { fuente: 'telemetria', tabla: 'sesiones_claude_code' },
  '08_densidad_interrupciones':       { fuente: 'telemetria', tabla: 'sesiones_claude_code' },
  '09_horas_por_proyecto':            { fuente: 'telemetria', tabla: 'registro_tiempo' },
  '10_sesiones_claude_code':          { fuente: 'telemetria', tabla: 'sesiones_claude_code' },
  '11_perfil_especializacion':        { fuente: 'telemetria', tabla: 'registro_tiempo.area (el doc dice "% de tiempo")' },
  '12_versatilidad':                  { fuente: 'sin_campo',  tabla: 'proyectos.tipo es texto libre, sin catálogo' },
  '13_commits_proyecto':              { fuente: 'respaldo',   tabla: 'commits' },
  '14_consistencia':                  { fuente: 'respaldo',   tabla: 'tareas_semanales cerradas por semana' },
  '15_rendimiento_hito':              { fuente: 'telemetria', tabla: 'hitos + registro_tiempo (el doc mide horas por hito)' },
  '16_contribucion_ponderada':        { fuente: 'telemetria', tabla: 'registro_tiempo.area' },
  '17_bus_factor':                    { fuente: 'respaldo',   tabla: 'commits por persona' },
  '18_ratio_colaboradores':           { fuente: 'telemetria', tabla: 'miembros_proyecto + registro_tiempo' },
  '19_capacidad_coordinacion':        { fuente: 'sin_campo',  tabla: 'no se registra tiempo de reuniones' },
  '20_estabilidad_equipo':            { fuente: 'respaldo',   tabla: 'miembros_proyecto.fecha_ingreso / fecha_salida' },
  '21_autosuficiencia':               { fuente: 'respaldo',   tabla: 'bloqueos.resuelto_por' },
  '22_ritmo_sostenido':               { fuente: 'respaldo',   tabla: 'commits por semana' },
  '23_autocomparacion':               { fuente: 'respaldo',   tabla: 'tareas_semanales cerradas' },
  '24_documentacion':                 { fuente: 'respaldo',   tabla: "commits.tipo_inferido = 'documentacion'" },
  '25_modo_solitario':                { fuente: 'telemetria', tabla: 'registro_tiempo + proyectos.modalidad' },
  '26_bloqueo_individual_compartido': { fuente: 'respaldo',   tabla: 'bloqueos + proyectos.modalidad' },
  '27_balance_carga':                 { fuente: 'telemetria', tabla: 'registro_tiempo' },
  '28_intervencion_cruzada':          { fuente: 'respaldo',   tabla: 'commits en proyectos individuales ajenos' },
  '29_avance_atribuido':              { fuente: 'respaldo',   tabla: 'tareas_semanales.completado' },
};

export function grupoDe(filas: Aplicabilidad[]): Grupo {
  const individual = filas.find((f) => f.modalidad === 'individual');
  const equipo = filas.find((f) => f.modalidad === 'equipo');
  if (!equipo) return 'Nuevo';
  if (individual && !individual.aplica) return 'C';
  if (individual?.sustituye_comparacion) return 'B';
  return 'A';
}

// Qué mostrar en la columna de una modalidad. Sin fila no es lo mismo que
// aplica=false: significa que nadie lo decidió todavía.
export type EstadoModalidad = 'aplica' | 'no_aplica' | 'sin_decidir';

export function estadoEn(filas: Aplicabilidad[], modalidad: Modalidad): EstadoModalidad {
  const fila = filas.find((f) => f.modalidad === modalidad);
  if (!fila) return 'sin_decidir';
  return fila.aplica ? 'aplica' : 'no_aplica';
}
