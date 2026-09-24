const DIA_MS = 24 * 60 * 60 * 1000;

// "hace 4 días" en vez de la fecha ISO cruda: es lo que se lee de un vistazo
// en una tabla densa. Con más de ~2 meses conviene la fecha, no un número raro.
export function tiempoRelativo(iso: string | null): string {
  if (!iso) return '—';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 60) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

export function aFechaIso(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// Duración entre dos timestamps, en días completos — para "abierto hace X
// días" o cuánto duró una etapa. `hasta` es opcional: sin ella, cuenta hasta
// ahora (algo todavía abierto).
export function diasEntre(desdeIso: string, hastaIso: string | null): number {
  const hasta = hastaIso ? new Date(hastaIso).getTime() : Date.now();
  return Math.max(0, Math.floor((hasta - new Date(desdeIso).getTime()) / DIA_MS));
}

// Una fecha sola ("2026-08-28", columnas `date` de Postgres) se arma como día
// local. `new Date('2026-08-28')` la toma como medianoche UTC, y en Colombia
// (UTC-5) eso cae el día anterior: la semana del 21 se mostraba "20 sept".
// Los timestamps con hora sí se pasan tal cual.
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const solo = SOLO_FECHA.exec(iso);
  const fecha = solo ? new Date(Number(solo[1]), Number(solo[2]) - 1, Number(solo[3])) : new Date(iso);
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
