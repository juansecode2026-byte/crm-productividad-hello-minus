import type { Aplicabilidad, IndicadorCatalogo } from '../lib/indicadores';
import { supabase } from '../lib/supabaseClient';

export async function listarCatalogo(): Promise<{ indicadores: IndicadorCatalogo[]; aplicabilidad: Aplicabilidad[] }> {
  const [catalogo, aplicabilidad] = await Promise.all([
    supabase.from('indicador_catalogo').select('indicador_code, nombre, categoria, descripcion').order('indicador_code'),
    supabase.from('indicador_aplicabilidad').select('indicador_code, modalidad, aplica, sustituye_comparacion'),
  ]);
  if (catalogo.error) throw catalogo.error;
  if (aplicabilidad.error) throw aplicabilidad.error;
  return { indicadores: catalogo.data, aplicabilidad: aplicabilidad.data };
}

// Qué códigos ya tienen al menos un snapshot real — el catálogo lo usa para
// marcar "Ver resultados" de otro color. Es una señal temporal: hoy casi todo
// da vacío porque el Motor recién corrió una semana; cuando haya más datos
// (reales o de prueba para ver la pantalla poblada) esto deja de ser noticia.
export async function listarIndicadoresConResultados(): Promise<Set<string>> {
  const { data, error } = await supabase.from('indicador_snapshots').select('indicador_code');
  if (error) throw error;
  return new Set(data.map((fila) => fila.indicador_code));
}

export async function obtenerIndicador(
  codigo: string,
): Promise<{ indicador: IndicadorCatalogo; aplicabilidad: Aplicabilidad[] } | null> {
  const [catalogo, aplicabilidad] = await Promise.all([
    supabase
      .from('indicador_catalogo')
      .select('indicador_code, nombre, categoria, descripcion')
      .eq('indicador_code', codigo)
      .maybeSingle(),
    supabase
      .from('indicador_aplicabilidad')
      .select('indicador_code, modalidad, aplica, sustituye_comparacion')
      .eq('indicador_code', codigo),
  ]);
  if (catalogo.error) throw catalogo.error;
  if (aplicabilidad.error) throw aplicabilidad.error;
  if (!catalogo.data) return null;
  return { indicador: catalogo.data, aplicabilidad: aplicabilidad.data };
}

export type ScopeIndicador = 'proyecto' | 'persona' | 'portafolio';

export interface Snapshot {
  scope_type: ScopeIndicador;
  scope_id: string | null;
  periodo: string;
  valor: number | null;
  detalle: unknown;
  calculado_en: string;
}

// Todos los snapshots del indicador, de todos los alcances, del más viejo al
// más nuevo. La página los agrupa por alcance; acá no se decide nada.
export async function listarSnapshots(codigo: string): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from('indicador_snapshots')
    .select('scope_type, scope_id, periodo, valor, detalle, calculado_en')
    .eq('indicador_code', codigo)
    .order('periodo', { ascending: true });
  if (error) throw error;
  // numeric llega como string desde PostgREST cuando tiene decimales.
  return data.map((fila) => ({
    ...fila,
    scope_type: fila.scope_type as ScopeIndicador,
    valor: fila.valor === null ? null : Number(fila.valor),
  }));
}

// Nombres para rotular alcances y el desglose por persona. Incluye personas
// inactivas: un snapshot viejo puede nombrar a alguien que ya salió.
export async function obtenerNombres(): Promise<{ proyectos: Map<string, string>; personas: Map<string, string> }> {
  const [proyectos, personas] = await Promise.all([
    supabase.from('proyectos').select('id, nombre'),
    supabase.from('personas').select('id, nombre'),
  ]);
  if (proyectos.error) throw proyectos.error;
  if (personas.error) throw personas.error;
  return {
    proyectos: new Map(proyectos.data.map((p) => [p.id, p.nombre])),
    personas: new Map(personas.data.map((p) => [p.id, p.nombre])),
  };
}

export interface AporteIntegrante {
  persona_id: string;
  asignadas: number;
  completadas: number;
  porcentaje: number;
}

export interface SnapshotAporte {
  periodo: string;
  calculado_en: string;
  por_persona: AporteIntegrante[];
}

// El último snapshot de "% de avance atribuido" (#29) de este proyecto.
// Se lee el snapshot, no se calcula acá: CLAUDE.md, "snapshots por periodo,
// no cálculo en vivo". `null` significa que el motor todavía no escribió
// ninguno — no hay tareas asignadas, o el calculador no corrió.
export async function obtenerAporteIntegrantes(proyectoId: string): Promise<SnapshotAporte | null> {
  const { data, error } = await supabase
    .from('indicador_snapshots')
    .select('periodo, calculado_en, detalle')
    .eq('indicador_code', '29_avance_atribuido')
    .eq('scope_type', 'proyecto')
    .eq('scope_id', proyectoId)
    .order('periodo', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const detalle = data.detalle as { por_persona?: AporteIntegrante[] } | null;
  return { periodo: data.periodo, calculado_en: data.calculado_en, por_persona: detalle?.por_persona ?? [] };
}
