// Este backend reporta su propia telemetría de agentes con el mismo paquete
// que instalaría cualquier otro proyecto (paquetes/hello-minus-telemetry) —
// no hay atajo especial por ser "el propio CRM". Piloto del experimento de
// costo (2026-09-25, acordado aparte de la Fase 07): arranca con un solo
// agente, el Verificador de checklist, antes de instrumentar los otros dos.
//
// Sin HELLO_MINUS_TELEMETRY_KEY en el entorno, crearTelemetria() queda
// inerte sola (avisa por consola, no lanza) — la telemetría nunca puede
// tumbar este backend, misma regla que para cualquier otro proyecto.
import { crearTelemetria } from '../../../paquetes/hello-minus-telemetry/index.js';

const telemetria = crearTelemetria();

export interface UsoTokens {
  tokensEntrada: number;
  tokensSalida: number;
}

// trazas_agente.tokens es UNA sola columna numérica (db/000_schema_inicial.sql)
// — no hay dónde separar entrada de salida dentro de la misma fila. Y hace
// falta separarlos: Opus cobra un precio muy distinto por token de entrada
// que por token de salida, así que sumarlos en un solo número dejaría el
// dato incompleto para lo único que este experimento existe — poder
// calcular el costo en dólares de una corrida real después, no a ojo.
//
// Por eso dos filas, no una — comparten run_id para poder volver a juntarlas
// (`group by run_id` del lado de quien analice trazas_agente después).
// node_name distingue cuál mitad es cada fila; agent_type identifica al
// agente en sí, no a esta corrida puntual.
export function registrarUsoVerificadorChecklist(runId: string, uso: UsoTokens): void {
  telemetria.traza({
    run_id: runId,
    agent_type: 'verificador_checklist',
    node_name: 'tokens_entrada',
    tokens: uso.tokensEntrada,
    status: 'ok',
  });
  telemetria.traza({
    run_id: runId,
    agent_type: 'verificador_checklist',
    node_name: 'tokens_salida',
    tokens: uso.tokensSalida,
    status: 'ok',
  });
}
