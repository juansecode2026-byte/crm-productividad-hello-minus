// Decide qué fecha mostrar como "cuándo se hizo" un ítem del checklist, y de
// dónde sale. Puro: no pega a la red ni a la base — recibe las fechas de
// commits ya consultadas y solo elige. Así se puede probar sin GitHub.
//
// Sin Claude a propósito (regla de STACK.md): el agente solo dice qué archivo
// respalda su veredicto; elegir la fecha es aritmética.

export type OrigenFecha = 'commit_archivo' | 'texto' | 'commit_claude_md';

export interface FechaEvidencia {
  fecha: string; // YYYY-MM-DD
  origen: OrigenFecha;
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

const ISO = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
// "25 ago 2026", "4 sept. 2026", "10 de septiembre de 2026". Sin año no se
// acepta: "7 sept" solo es ambiguo, y adivinar el año es inventar.
const TEXTO = new RegExp(
  `\\b(\\d{1,2})\\s+(?:de\\s+)?(${Object.keys(MESES).join('|')})\\.?\\s+(?:de\\s+)?(20\\d{2})\\b`,
  'gi',
);

function aIso(anio: number, mes: number, dia: number): string | null {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  // El Date corrige solo un 31 de febrero a marzo; si no coincide, no existía.
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return null;
  }
  return fecha.toISOString().slice(0, 10);
}

// La fecha más reciente escrita en el texto, siempre que no sea futura. La
// más reciente porque una declaración como "decidido el 2026-09-17, aplicada
// 2026-09-23" termina en la segunda; y nada futuro, porque "se lanza el
// 2026-12-01" es un plan, no algo hecho.
export function fechaEscritaEn(texto: string, hoy: string): string | null {
  const encontradas: string[] = [];

  for (const m of texto.matchAll(ISO)) {
    const iso = aIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) encontradas.push(iso);
  }
  for (const m of texto.matchAll(TEXTO)) {
    const mes = MESES[m[2]!.toLowerCase()];
    const iso = mes ? aIso(Number(m[3]), mes, Number(m[1])) : null;
    if (iso) encontradas.push(iso);
  }

  const validas = encontradas.filter((f) => f <= hoy).sort();
  return validas.at(-1) ?? null;
}

// Orden de preferencia, de la más sólida a la más débil:
//   1. El último commit del archivo que el agente citó (si no es el CLAUDE.md).
//   2. Una fecha escrita a mano dentro de la evidencia.
//   3. El último commit del CLAUDE.md — solo si el veredicto se apoyó en él.
//      Si se apoyó en la forma de las carpetas, esa fecha no dice nada del ítem.
export function resolverFechaEvidencia(entrada: {
  archivo: string | null;
  evidencia: string;
  fechaDelArchivo: string | null;
  fechaClaudeMd: string | null;
  hoy: string;
}): FechaEvidencia | null {
  const { archivo, evidencia, fechaDelArchivo, fechaClaudeMd, hoy } = entrada;

  if (archivo && archivo !== 'CLAUDE.md' && fechaDelArchivo) {
    return { fecha: fechaDelArchivo, origen: 'commit_archivo' };
  }

  const escrita = fechaEscritaEn(evidencia, hoy);
  if (escrita) return { fecha: escrita, origen: 'texto' };

  if (archivo === 'CLAUDE.md' && fechaClaudeMd) {
    return { fecha: fechaClaudeMd, origen: 'commit_claude_md' };
  }

  return null;
}
