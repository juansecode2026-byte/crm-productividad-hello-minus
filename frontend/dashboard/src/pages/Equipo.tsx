import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { fechaCorta } from '../lib/fechas';
import type { CapacidadPersona, Persona } from '../lib/tipos';
import { declararCapacidad, listarCapacidad } from '../services/capacidadService';
import { listarPersonasEquipo } from '../services/personasService';
import estilos from './Equipo.module.css';

type PersonaEquipo = Pick<Persona, 'id' | 'nombre' | 'rol'>;

const nombreRol: Record<string, string> = {
  admin: 'admin',
  lider_proyecto: 'líder de proyecto',
  colaborador: 'colaborador',
};

export function Equipo() {
  const [personas, setPersonas] = useState<PersonaEquipo[]>([]);
  const [capacidades, setCapacidades] = useState<Record<string, CapacidadPersona[]>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargarTodo() {
    setError(null);
    try {
      const pers = await listarPersonasEquipo();
      const listas = await Promise.all(pers.map((p) => listarCapacidad(p.id)));
      setPersonas(pers);
      setCapacidades(pers.reduce<Record<string, CapacidadPersona[]>>((mapa, p, i) => {
        mapa[p.id] = listas[i] ?? [];
        return mapa;
      }, {}));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo cargar el equipo');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  const [horasPorPersona, setHorasPorPersona] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  // Declarar capacidad no pisa la anterior: agrega una fila con vigente_desde
  // = hoy (lo fija el backend), y la vieja queda de historial. Por eso alcanza
  // con anteponerla a la lista que ya había.
  async function declarar(evento: FormEvent, personaId: string) {
    evento.preventDefault();
    const horas = Number(horasPorPersona[personaId]);
    if (!horas || horas <= 0) return;
    setError(null);
    setEnviando(personaId);
    try {
      const nueva = await declararCapacidad(personaId, horas);
      setCapacidades((actual) => ({ ...actual, [personaId]: [nueva, ...(actual[personaId] ?? [])] }));
      setHorasPorPersona((actual) => ({ ...actual, [personaId]: '' }));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo declarar la capacidad');
    } finally {
      setEnviando(null);
    }
  }

  return (
    <AppShell>
      <header className={estilos.cabecera}>
        <h1>Equipo</h1>
        <p className={estilos.subtitulo}>
          Capacidad semanal declarada por persona. La usa el indicador #06 (carga vs. capacidad) para comparar
          contra las horas reales de cada semana — sin esto, ese indicador no tiene con qué medir.
        </p>
      </header>

      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      {cargando ? (
        <p className={estilos.vacio}>Cargando…</p>
      ) : (
        <div className={estilos.lista}>
          {personas.map((persona) => {
            const historial = capacidades[persona.id] ?? [];
            const actual = historial[0] ?? null;
            const restoHistorial = historial.slice(1);
            return (
              <section key={persona.id} className={estilos.tarjeta}>
                <div className={estilos.encabezado}>
                  <div>
                    <h2>{persona.nombre}</h2>
                    <span className={estilos.rol}>{nombreRol[persona.rol] ?? persona.rol}</span>
                  </div>
                  <div className={estilos.capacidadActual}>
                    {actual ? (
                      <>
                        <span className={estilos.horas}>{actual.horas_semanales} h/semana</span>
                        <span className={estilos.vigente}>desde {fechaCorta(actual.vigente_desde)}</span>
                      </>
                    ) : (
                      <span className={estilos.sinDeclarar}>sin declarar</span>
                    )}
                  </div>
                </div>

                {restoHistorial.length > 0 && (
                  <details className={estilos.historial}>
                    <summary>Historial ({restoHistorial.length})</summary>
                    <ul>
                      {restoHistorial.map((c) => (
                        <li key={c.id}>
                          {c.horas_semanales} h/semana desde {fechaCorta(c.vigente_desde)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <form className={estilos.form} onSubmit={(evento) => declarar(evento, persona.id)}>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    step="0.5"
                    value={horasPorPersona[persona.id] ?? ''}
                    onChange={(e) =>
                      setHorasPorPersona((actual) => ({ ...actual, [persona.id]: e.target.value }))
                    }
                    placeholder="horas/semana"
                    disabled={enviando === persona.id}
                    aria-label={`Horas semanales de ${persona.nombre}`}
                  />
                  <button type="submit" disabled={enviando === persona.id || !horasPorPersona[persona.id]}>
                    declarar desde hoy
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
