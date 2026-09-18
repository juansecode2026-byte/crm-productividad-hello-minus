// Las 9 etapas, definidas en CLAUDE.md el 2026-09-18. Vocabulario fijo, igual
// que un enum — no hay tabla catálogo en la base, así que vive acá también
// como constante, no como fetch.
export interface Etapa {
  numero: number;
  nombre: string;
}

export const ETAPAS: Etapa[] = [
  { numero: 1, nombre: 'Descubrimiento y alcance' },
  { numero: 2, nombre: 'Diseño y arquitectura' },
  { numero: 3, nombre: 'Configuración del entorno' },
  { numero: 4, nombre: 'Construcción del núcleo' },
  { numero: 5, nombre: 'Construcción de agentes de IA' },
  { numero: 6, nombre: 'Integración' },
  { numero: 7, nombre: 'Pruebas y aseguramiento' },
  { numero: 8, nombre: 'Despliegue y piloto' },
  { numero: 9, nombre: 'Operación y mejora continua' },
];

export function nombreEtapa(numero: number): string {
  return ETAPAS.find((e) => e.numero === numero)?.nombre ?? `Etapa ${numero}`;
}
