import { useEffect, useState, type FormEvent } from 'react';
import { fechaCorta } from '../lib/fechas';
import type { Reunion } from '../lib/tipos';
import { borrarReunion, listarReuniones, registrarReunion } from '../services/reunionesService';
import estilos from './Reuniones.module.css';

interface Props {
  proyectoId: string;
  nombrePersona: (id: string) => string;
}

// Única captura manual de tiempo del sistema (indicador #19, migración 017) —
// registro_tiempo sigue 100% inferido. Vive como sección aparte del proyecto,
// no mezclada con bloqueos ni tareas: es tiempo declarado, no rastro detectado.
export function Reuniones({ proyectoId, nombrePersona }: Props) {
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setError(null);
    try {
      setReuniones(await listarReuniones(proyectoId));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudieron cargar las reuniones');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId]);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [fecha, setFecha] = useState('');
  const [horas, setHoras] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function registrar(evento: FormEvent) {
    evento.preventDefault();
    const horasNum = Number(horas);
    if (!fecha || !horasNum || horasNum <= 0) return;
    setEnviando(true);
    setError(null);
    try {
      const nueva = await registrarReunion(proyectoId, { fecha, horas: horasNum, descripcion: descripcion.trim() || null });
      setReuniones((actual) => [nueva, ...actual]);
      setMostrarForm(false);
      setFecha('');
      setHoras('');
      setDescripcion('');
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo registrar la reunión');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(reunion: Reunion) {
    try {
      await borrarReunion(proyectoId, reunion.id);
      setReuniones((actual) => actual.filter((r) => r.id !== reunion.id));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo borrar la reunión');
    }
  }

  return (
    <section className={estilos.seccion}>
      <div className={estilos.encabezado}>
        <h2>Reuniones</h2>
        <span className={estilos.permiso}>cada quien registra las propias</span>
      </div>

      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      {!cargando && (
        <div className={estilos.bloque}>
          {reuniones.length === 0 && <p className={estilos.vacio}>Todavía no hay reuniones registradas.</p>}

          {reuniones.map((reunion) => (
            <div key={reunion.id} className={estilos.fila}>
              <div className={estilos.datos}>
                <span className={estilos.fecha}>{fechaCorta(reunion.fecha)}</span>
                <span className={estilos.horas}>{reunion.horas} h</span>
                <span className={estilos.persona}>{nombrePersona(reunion.persona_id)}</span>
              </div>
              {reunion.descripcion && <p className={estilos.descripcion}>{reunion.descripcion}</p>}
              <button type="button" className={estilos.borrar} onClick={() => eliminar(reunion)} aria-label="Borrar reunión">
                ✕
              </button>
            </div>
          ))}

          {mostrarForm ? (
            <form className={estilos.form} onSubmit={registrar}>
              <div className={estilos.filaForm}>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={enviando} aria-label="Fecha" />
                <input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder="horas"
                  disabled={enviando}
                  aria-label="Horas"
                />
              </div>
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción (opcional)"
                disabled={enviando}
              />
              <div className={estilos.accionesFila}>
                <button type="submit" disabled={enviando || !fecha || !horas}>
                  Registrar
                </button>
                <button type="button" className={estilos.btnFantasma} onClick={() => setMostrarForm(false)} disabled={enviando}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className={estilos.btnAbrirForm} onClick={() => setMostrarForm(true)}>
              + registrar reunión
            </button>
          )}
        </div>
      )}
    </section>
  );
}
