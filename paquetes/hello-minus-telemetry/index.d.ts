export interface TrazaAgente {
  /** Identifica una corrida completa del agente. Obligatorio. */
  run_id: string;
  agent_id?: string;
  agent_type?: string;
  environment?: string;
  iteration_index?: number;
  node_name?: string;
  tool_name?: string;
  args_hash?: string;
  tokens?: number;
  duration_ms?: number;
  status?: string;
}

export interface SesionClaudeCode {
  /** Identifica la sesión. Se puede reportar varias veces: la última gana. */
  session_id: string;
  /** Fecha ISO. Obligatoria. */
  inicio: string;
  fin?: string;
  /** Email o usuario de GitHub. Se resuelve contra `personas` del CRM. */
  persona?: string;
  prompt_count?: number;
  duracion_activa_segundos?: number;
  archivos_tocados?: string[];
}

export interface OpcionesTelemetria {
  /** Por defecto `HELLO_MINUS_TELEMETRY_KEY` del entorno. Sin clave, queda inerte. */
  clave?: string;
  /** Por defecto `HELLO_MINUS_TELEMETRY_URL` o el endpoint del CRM. */
  url?: string;
  /** Milisegundos de agrupación antes de enviar. Por defecto 5000. */
  loteMs?: number;
  /** Eventos por lote antes de enviar sin esperar. Por defecto 100. */
  maxLote?: number;
  /** Qué hacer si el envío falla. Por defecto, un aviso por consola. */
  alFallar?: (error: Error) => void;
}

export interface Telemetria {
  traza(evento: TrazaAgente): void;
  sesion(evento: SesionClaudeCode): void;
  /** Envía lo pendiente. Llamalo antes de que el proceso termine. */
  vaciar(): Promise<void>;
  readonly activo: boolean;
}

export function crearTelemetria(opciones?: OpcionesTelemetria): Telemetria;
