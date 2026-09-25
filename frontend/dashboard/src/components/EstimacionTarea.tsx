import { useEffect, useState, type FormEvent } from 'react';
import { fechaCorta } from '../lib/fechas';
import type { EstimacionTarea as TipoEstimacion } from '../lib/tipos';
import { crearEstimacion, listarEstimaciones } from '../services/estimacionesService';
import estilos from './EstimacionTarea.module.css';

interface Props {
  proyectoId: string;
  tareaId: string;
  semanaInicio: string;
  semanaFin: string;
}

// Indicador #03 (precisión de estimación). Solo quien tiene la tarea asignada
// puede estimarla (escribir_estimaciones lo exige en RLS) — se muestra igual
// para cualquiera que vea el proyecto, como el resto de los formularios de
// esta pantalla; si no es la propia tarea, la API responde 403.
export function EstimacionTarea({ proyectoId, tareaId, semanaInicio, semanaFin }: Props) {
  const [estimaciones, setEstimaciones] = useState<TipoEstimacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [horas, setHoras] = useState('');
  const [inicio, setInicio] = useState(semanaInicio);
  const [fin, setFin] = useState(semanaFin);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarEstimaciones(proyectoId, tareaId)
      .then(setEstimaciones)
      .catch(() => setEstimaciones([]))
      .finally(() => setCargando(false));
  }, [proyectoId, tareaId]);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    const horasNum = Number(horas);
    if (!horasNum || horasNum <= 0 || !inicio || !fin) return;
    setEnviando(true);
    setError(null);
    try {
      const nueva = await crearEstimacion(proyectoId, tareaId, {
        horas_estimadas: horasNum,
        fecha_inicio: inicio,
        fecha_fin: fin,
      });
      setEstimaciones((actual) => [nueva, ...actual]);
      setMostrarForm(false);
      setHoras('');
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo estimar la tarea');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return null;

  return (
    <div className={estilos.envoltura}>
      {estimaciones.length > 0 && (
        <div className={estilos.lista}>
          {estimaciones.map((est) => (
            <span key={est.id} className={estilos.chip}>
              {est.horas_estimadas}h estimadas · {fechaCorta(est.fecha_inicio)}–{fechaCorta(est.fecha_fin)}
            </span>
          ))}
        </div>
      )}

      {error && <p className={estilos.error}>{error}</p>}

      {mostrarForm ? (
        <form className={estilos.form} onSubmit={crear}>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            placeholder="horas"
            disabled={enviando}
            aria-label="Horas estimadas"
          />
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            disabled={enviando}
            aria-label="Estimación válida desde"
          />
          <input
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            disabled={enviando}
            aria-label="Estimación válida hasta"
          />
          <button type="submit" disabled={enviando || !horas}>
            guardar
          </button>
          <button type="button" className={estilos.btnFantasma} onClick={() => setMostrarForm(false)} disabled={enviando}>
            cancelar
          </button>
        </form>
      ) : (
        <button type="button" className={estilos.btnEstimar} onClick={() => setMostrarForm(true)}>
          + estimar
        </button>
      )}
    </div>
  );
}
