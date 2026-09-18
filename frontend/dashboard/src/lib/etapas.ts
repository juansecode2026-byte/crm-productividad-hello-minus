// Las 9 etapas, definidas en CLAUDE.md el 2026-09-18. Vocabulario fijo, igual
// que un enum — no hay tabla catálogo en la base, así que vive acá también
// como constante, no como fetch.
//
// `construye` responde "¿qué se hace en esta etapa?" y se muestra al elegir
// la etapa de un proyecto: sin eso, "Integración" o "Construcción del núcleo"
// no le dicen lo mismo a dos personas distintas. `saleCon` es el criterio de
// cierre — cuándo se puede pasar a la siguiente. Los dos textos están también
// en CLAUDE.md; si cambian acá, cambian allá.
export interface Etapa {
  numero: number;
  nombre: string;
  construye: string;
  saleCon: string;
}

export const ETAPAS: Etapa[] = [
  {
    numero: 1,
    nombre: 'Descubrimiento y alcance',
    construye: 'Nada técnico todavía: notas, requisitos, para qué es y quién lo pidió.',
    saleCon: 'Está claro para qué es el proyecto y quién lo pidió.',
  },
  {
    numero: 2,
    nombre: 'Diseño y arquitectura',
    construye: 'Modelo de datos (tablas y relaciones), elección del stack, lista de componentes.',
    saleCon: 'Esquema de datos y componentes listados. Congela el alcance del proyecto.',
  },
  {
    numero: 3,
    nombre: 'Configuración del entorno',
    construye: 'Repos, hosting, variables de entorno, CI/CD, claves. La carpintería antes de la lógica.',
    saleCon: 'El proyecto corre local y despliega un "hola mundo".',
  },
  {
    numero: 4,
    nombre: 'Construcción del núcleo',
    construye: 'Base de datos, backend (API) y frontend (pantallas). El grueso del trabajo.',
    saleCon: 'Los tres funcionan de punta a punta, aunque sin pulir.',
  },
  {
    numero: 5,
    nombre: 'Construcción de agentes de IA',
    construye:
      'Prompts y herramientas de cada agente. También automatizaciones no-code (n8n, Zapier, Make) cuando deciden algo, no solo mueven datos.',
    saleCon: 'Cada agente cumple contra casos de prueba reales.',
  },
  {
    numero: 6,
    nombre: 'Integración',
    construye:
      'Conectar las piezas entre sí y con afuera: webhooks, APIs externas, backend con frontend. Acá es donde n8n suele orquestar sistemas que ya existen.',
    saleCon: 'Un dato que entra por un canal llega correcto al otro extremo.',
  },
  {
    numero: 7,
    nombre: 'Pruebas y aseguramiento',
    construye: 'Tests, evaluaciones de los agentes, revisión de permisos y seguridad.',
    saleCon: 'Sin errores críticos conocidos; los agentes evaluados, no solo probados a ojo.',
  },
  {
    numero: 8,
    nombre: 'Despliegue y piloto',
    construye: 'Puesta en producción real, con vigilancia cercana antes de soltarlo del todo.',
    saleCon: 'Corrió en producción un tiempo razonable sin incidentes graves.',
  },
  {
    numero: 9,
    nombre: 'Operación y mejora continua',
    construye: 'Mantenimiento, features nuevas y correcciones que aparecen con el uso real.',
    saleCon: 'No sale: es la etapa de reposo mientras el proyecto siga activo.',
  },
];

export function buscarEtapa(numero: number): Etapa | undefined {
  return ETAPAS.find((etapa) => etapa.numero === numero);
}

export function nombreEtapa(numero: number): string {
  return buscarEtapa(numero)?.nombre ?? `Etapa ${numero}`;
}
