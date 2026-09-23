// Los agentes propios de este CRM, con su forma real: loop, grafo y harness.
// Vive acá y no en una tabla, mismo criterio que etapas.ts — es un hecho del
// código (cuántos pasos tiene, si vuelve sobre su salida), no un dato que
// cambie por proyecto ni por hora. Si un agente cambia de forma, cambia acá.
//
// `pasos` es el grafo: una lista ordenada, cada uno con su tipo (de dónde sale
// la decisión) y opcionalmente cuántas veces corre por llamada. `tieneLoop` es
// aparte a propósito — hoy los tres agentes son `false`, y el día que uno la
// tenga, la pantalla lo muestra distinto de un vistazo sin tocar el resto del
// dato. Ver la sección "Verificador de checklist" y sus hermanos en
// CLAUDE.md para el detalle completo de cada uno.

export type TipoPaso = 'llm' | 'script' | 'escritura';

export interface PasoAgente {
  titulo: string;
  detalle: string;
  tipo: TipoPaso;
  repite?: string; // "por commit", "por lote"... solo si el paso itera dentro de la llamada.
}

export type Disparador = 'cron' | 'boton';

export interface Agente {
  id: string;
  nombre: string;
  resumen: string;
  modelo: string;
  effort: 'low' | 'medium';
  tieneLoop: boolean;
  pasos: PasoAgente[];
  harness: {
    disparador: Disparador;
    texto: string;
    definidoEn: string;
  };
}

export const AGENTES: Agente[] = [
  {
    id: 'clasificador-commits',
    nombre: 'Clasificador de commits',
    resumen: 'Decide qué tipo de cambio fue cada commit, y de qué área.',
    modelo: 'claude-opus-5',
    effort: 'low',
    tieneLoop: false,
    pasos: [
      {
        titulo: 'Decide el tipo',
        detalle: 'Con IA, todo el lote junto: funcionalidad, arreglo, refactor, documentación, configuración u otro.',
        tipo: 'llm',
        repite: 'por lote',
      },
      {
        titulo: 'Decide el área',
        detalle: 'Sin IA, mirando qué archivos tocó: script determinístico, nunca lo calcula el modelo.',
        tipo: 'script',
        repite: 'por commit',
      },
      {
        titulo: 'Guarda',
        detalle: 'Escribe tipo_inferido y area_inferida juntos en la misma fila.',
        tipo: 'escritura',
      },
    ],
    harness: {
      disparador: 'cron',
      texto: 'GitHub Actions lo despierta cada 3 días; un proceso Python corre el grafo y se apaga.',
      definidoEn: '.github/workflows/clasificador-commits.yml',
    },
  },
  {
    id: 'sugeridor-etapa',
    nombre: 'Sugeridor de etapa',
    resumen: 'Mira un repo una vez y propone en cuál de las 9 etapas está, con evidencia.',
    modelo: 'claude-opus-5',
    effort: 'medium',
    tieneLoop: false,
    pasos: [
      {
        titulo: 'Propone la etapa',
        detalle: 'Estructura del repo + actividad de commits en una sola llamada. Elige la etapa más temprana ante la duda.',
        tipo: 'llm',
      },
    ],
    harness: {
      disparador: 'boton',
      texto: 'Botón "Sugerir con agente IA" al vincular un repo; la persona confirma antes de guardar.',
      definidoEn: 'backend/api/services/sugeridorEtapa.ts',
    },
  },
  {
    id: 'verificador-checklist',
    nombre: 'Verificador de checklist',
    resumen: 'Juzga hasta 80 ítems del checklist en una sola llamada: sin_empezar, en_proceso o hecho.',
    modelo: 'claude-opus-5',
    effort: 'medium',
    tieneLoop: false,
    pasos: [
      {
        titulo: 'Veredicto por ítem',
        detalle: 'Un veredicto de tres estados por cada ítem sin confirmar, con evidencia citada del repo o su CLAUDE.md.',
        tipo: 'llm',
        repite: 'hasta 80 ítems',
      },
    ],
    harness: {
      disparador: 'boton',
      texto: 'Botón "Generar con agente IA" / "Volver a escanear" en el detalle del proyecto.',
      definidoEn: 'backend/api/services/verificadorChecklist.ts',
    },
  },
];

export function buscarAgente(id: string): Agente | undefined {
  return AGENTES.find((a) => a.id === id);
}
