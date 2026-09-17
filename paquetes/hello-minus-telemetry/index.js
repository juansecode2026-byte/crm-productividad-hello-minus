// Cliente de telemetría de Hello Minus.
//
// Regla de oro: la telemetría NUNCA rompe ni frena al proyecto que la usa.
// Todo fallo se traga con un aviso por consola, los envíos no bloquean, y el
// temporizador no impide que el proceso termine.
//
// Sin dependencias y en JS plano a propósito: el proyecto que lo instala no
// tiene que compilar nada ni arrastrar un árbol de paquetes por un cliente
// de 150 líneas.

const URL_POR_DEFECTO = 'https://qutqsyokdlitflybfrus.supabase.co/functions/v1/ingesta-telemetria';

// El endpoint acepta 500 por petición; 100 deja margen y mantiene los cuerpos chicos.
const MAX_LOTE = 100;
const INTERVALO_MS = 5000;
const REINTENTOS = 1;

function avisar(mensaje, detalle) {
  console.warn(`[hello-minus-telemetry] ${mensaje}`, detalle ?? '');
}

/**
 * @param {{ clave?: string, url?: string, loteMs?: number, maxLote?: number, alFallar?: (error: Error) => void }} opciones
 */
export function crearTelemetria(opciones = {}) {
  const clave = opciones.clave ?? leerEnv('HELLO_MINUS_TELEMETRY_KEY');
  const url = opciones.url ?? leerEnv('HELLO_MINUS_TELEMETRY_URL') ?? URL_POR_DEFECTO;
  const maxLote = opciones.maxLote ?? MAX_LOTE;
  const loteMs = opciones.loteMs ?? INTERVALO_MS;
  const alFallar = opciones.alFallar ?? ((error) => avisar('no se pudo enviar:', error.message));

  // Sin clave el cliente queda inerte en vez de explotar: un proyecto sin
  // configurar tiene que poder arrancar igual.
  const activo = Boolean(clave);
  if (!activo) avisar('sin HELLO_MINUS_TELEMETRY_KEY: la telemetría queda desactivada');

  const pendientes = { traza_agente: [], sesion_claude_code: [] };
  let temporizador = null;
  let enVuelo = Promise.resolve();

  function programar() {
    if (temporizador || !activo) return;
    temporizador = setTimeout(() => {
      temporizador = null;
      vaciar();
    }, loteMs);
    // No mantener vivo el proceso solo por un envío de telemetría pendiente.
    if (typeof temporizador.unref === 'function') temporizador.unref();
  }

  function encolar(tipo, evento) {
    if (!activo) return;
    pendientes[tipo].push(evento);
    if (pendientes[tipo].length >= maxLote) vaciar();
    else programar();
  }

  async function enviar(tipo, eventos) {
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        const respuesta = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': clave },
          body: JSON.stringify({ tipo, eventos }),
        });
        if (respuesta.ok) return;

        // 4xx es culpa del que llama (esquema o clave): reintentar no arregla nada.
        if (respuesta.status < 500) {
          const cuerpo = await respuesta.text().catch(() => '');
          throw new Error(`${respuesta.status} ${cuerpo}`.trim());
        }
        if (intento === REINTENTOS) throw new Error(`${respuesta.status} tras ${REINTENTOS + 1} intentos`);
      } catch (error) {
        if (intento === REINTENTOS) {
          alFallar(error instanceof Error ? error : new Error(String(error)));
          return;
        }
      }
    }
  }

  function vaciar() {
    if (!activo) return enVuelo;

    const lotes = [];
    for (const tipo of Object.keys(pendientes)) {
      if (pendientes[tipo].length === 0) continue;
      lotes.push([tipo, pendientes[tipo]]);
      pendientes[tipo] = [];
    }
    if (lotes.length === 0) return enVuelo;

    // Se encadena para que `await vaciar()` espere también lo que ya iba en camino.
    enVuelo = enVuelo.then(() => Promise.all(lotes.map(([tipo, eventos]) => enviar(tipo, eventos)))).then(() => {});
    return enVuelo;
  }

  return {
    /** Una traza de agente. Requiere run_id. */
    traza(evento) {
      if (!evento || !evento.run_id) return avisar('traza sin run_id, se descarta');
      encolar('traza_agente', evento);
    },

    /** Una sesión de Claude Code. Requiere session_id e inicio. */
    sesion(evento) {
      if (!evento || !evento.session_id) return avisar('sesión sin session_id, se descarta');
      if (!evento.inicio) return avisar('sesión sin inicio, se descarta');
      encolar('sesion_claude_code', evento);
    },

    /** Envía lo pendiente ya. Llamalo antes de que el proceso termine. */
    vaciar,

    /** Para tests y diagnóstico. */
    get activo() {
      return activo;
    },
  };
}

function leerEnv(nombre) {
  if (typeof process !== 'undefined' && process.env) return process.env[nombre];
  return undefined;
}
