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
