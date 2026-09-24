import { useId, useState } from 'react';
import { fechaCorta } from '../lib/fechas';
import type { OrigenFechaEvidencia } from '../lib/tipos';
import estilos from './PieEvidencia.module.css';

// La línea de firma de un ítem del checklist, con la fecha de su evidencia y
// un ⓘ que explica qué fecha es. El ⓘ se abre con clic o toque — no con el
// mouse encima, que en el celular no existe y con teclado tampoco.
//
// El rótulo cambia según el origen porque las tres fechas no valen lo mismo
// (ver db/migrations/016): esconder la diferencia detrás de un solo "terminado
// el" sería presentar la más débil con la misma confianza que la más fuerte.
interface Props {
  prefijo: string;
  tono: 'detectado' | 'confirmado';
  fecha: string | null;
  origen: OrigenFechaEvidencia | null;
  archivo: string | null;
}

function rotulo(origen: OrigenFechaEvidencia | null, fecha: string | null): string {
  if (!origen || !fecha) return 'sin fecha de evidencia';
  const f = fechaCorta(fecha);
  if (origen === 'commit_archivo') return `último commit de la evidencia: ${f}`;
  if (origen === 'texto') return `fecha escrita en la evidencia: ${f}`;
  return `el CLAUDE.md cambió por última vez: ${f}`;
}

function explicacion(origen: OrigenFechaEvidencia | null, archivo: string | null) {
  if (origen === 'commit_archivo') {
    return (
      <>
        <b>¿Qué fecha es esta?</b> La del último commit que modificó <code>{archivo}</code>, el
        archivo que el agente citó como prueba. Suele coincidir con cuándo se terminó esa parte,
        pero no siempre: si alguien edita el archivo después —aunque sea para corregir un
        comentario— la fecha se mueve. No es la fecha en que el agente lo revisó ni la de la
        confirmación.
      </>
    );
  }
  if (origen === 'texto') {
    return (
      <>
        <b>¿Qué fecha es esta?</b> Una que alguien escribió a mano en la frase citada como
        evidencia (por ejemplo, "aplicada 2026-09-23"). Es la más directa de todas: no se dedujo,
        la declaró quien hizo el trabajo.
      </>
    );
  }
  if (origen === 'commit_claude_md') {
    return (
      <>
        <b>¿Qué fecha es esta?</b> El agente dio esto por hecho leyendo el CLAUDE.md, sin un archivo
        puntual ni una fecha escrita. Esta es la del último cambio del CLAUDE.md: la aproximación
        más débil, porque ese archivo pudo editarse mucho después y por otra razón.
      </>
    );
  }
  return (
    <>
      <b>¿Por qué no hay fecha?</b> El agente no citó un archivo puntual y la evidencia no trae una
      fecha escrita, así que no hay de dónde sacar una fecha real. Mostrar una igual sería
      inventarla.
    </>
  );
}

// Calendario en trazo — nunca emoji, y el color sigue al `currentColor` del
// botón (texto e ícono cambian juntos con hover/foco, una sola regla de CSS).
function IconoCalendario() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={estilos.icono}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function PieEvidencia({ prefijo, tono, fecha, origen, archivo }: Props) {
  const [abierta, setAbierta] = useState(false);
  const idExplicacion = useId();
  const tieneFecha = Boolean(fecha && origen);

  // Lo confirmado sin fecha no dice "sin fecha": puede venir de una
  // confirmación a mano, sin escaneo, y ahí la ausencia no es información.
  if (tono === 'confirmado' && !tieneFecha) {
    return <div className={`${estilos.pie} ${estilos.confirmado}`}>{prefijo}</div>;
  }

  return (
    <>
      <div className={`${estilos.pie} ${estilos[tono]}`}>
        <span>{prefijo}</span>
        <span className={estilos.separador}>·</span>
        {/* La fecha entera es el disparador — no un círculo aparte al lado.
            Área de clic mucho más grande (Fitts) y el patrón "texto con
            subrayado punteado" ya se lee como interactivo sin instrucción. */}
        <button
          type="button"
          className={estilos.disparador}
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          aria-controls={idExplicacion}
        >
          <IconoCalendario />
          <span className={tieneFecha ? estilos.fecha : estilos.sinFecha}>{rotulo(origen, fecha)}</span>
        </button>
      </div>
      {abierta && (
        <div id={idExplicacion} className={estilos.explicacion}>
          {explicacion(tieneFecha ? origen : null, archivo)}
        </div>
      )}
    </>
  );
}
