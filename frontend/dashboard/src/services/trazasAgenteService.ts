import { supabase } from '../lib/supabaseClient';

// Cuántos proyectos ajenos (no este CRM, que no se traza a sí mismo) tienen
// al menos una fila en trazas_agente. Hoy da 0 porque ningún repo instaló
// hello-minus-telemetry todavía (verificado buscando la referencia en los 6
// repos candidatos, 2026-09-22) — pero es una consulta real, no un cero fijo:
// el día que alguien lo instale, este número cambia solo.
export async function contarProyectosConAgentesReportando(): Promise<number> {
  const { data, error } = await supabase.from('trazas_agente').select('proyecto_id').not('proyecto_id', 'is', null);
  if (error) throw error;
  return new Set(data.map((fila) => fila.proyecto_id)).size;
}
