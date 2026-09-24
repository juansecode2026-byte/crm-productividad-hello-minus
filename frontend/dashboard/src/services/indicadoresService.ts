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
