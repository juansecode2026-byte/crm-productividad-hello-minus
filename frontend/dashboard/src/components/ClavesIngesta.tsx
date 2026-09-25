import { useEffect, useState, type FormEvent } from 'react';
import { fechaCorta } from '../lib/fechas';
import type { ClaveIngesta } from '../lib/tipos';
import { crearClave, listarClaves, revocarClave } from '../services/clavesService';
import estilos from './ClavesIngesta.module.css';

interface Props {
  proyectoId: string;
}

// Sección del detalle de proyecto para gestionar las claves con las que OTROS
// proyectos reportan su telemetría acá (paquetes/hello-minus-telemetry o las
// variables OTEL de Claude Code) — ver "Canal 2" en CLAUDE.md.
export function ClavesIngesta({ proyectoId }: Props) {
  const [claves, setClaves] = useState<ClaveIngesta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [enviando, setEnviando] = useState(false);
  // La clave en claro solo existe acá, en memoria del navegador, entre que el
  // backend la devuelve y quien la creó la copia. La lista de `claves` nunca
  // la tiene (esa solo trae el prefijo) y no se puede volver a pedir.
  const [claveNueva, setClaveNueva] = useState<{ nombre: string; clave: string } | null>(null);

  async function cargar() {
    setError(null);
    try {
      setClaves(await listarClaves(proyectoId));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudieron cargar las claves');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId]);

  async function crearNuevaClave(evento: FormEvent) {
    evento.preventDefault();
    if (!nombreNuevo.trim()) return;
    setError(null);
    setEnviando(true);
    try {
      const { clave, ...datos } = await crearClave(proyectoId, nombreNuevo.trim());
      setClaves((actual) => [datos, ...actual]);
      setClaveNueva({ nombre: datos.nombre, clave });
      setNombreNuevo('');
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo crear la clave');
    } finally {
      setEnviando(false);
    }
  }

  async function revocar(clave: ClaveIngesta) {
    try {
      const actualizada = await revocarClave(proyectoId, clave.id);
      setClaves((actual) => actual.map((c) => (c.id === clave.id ? actualizada : c)));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'No se pudo revocar la clave');
    }
  }

  return (
    <section className={estilos.seccion}>
      <div className={estilos.encabezado}>
        <h2>Claves de ingesta</h2>
        <span className={estilos.permiso}>solo el encargado o el admin crea o revoca</span>
      </div>

      <p className={estilos.nota}>
        Con una de estas claves, otro proyecto reporta acá su telemetría (agentes propios con{' '}
        <code>HELLO_MINUS_TELEMETRY_KEY</code>, o Claude Code con{' '}
        <code>OTEL_EXPORTER_OTLP_HEADERS</code>).
      </p>

      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      {claveNueva && (
        <div className={estilos.claveNueva} role="alert">
          <p>
            Clave de <b>{claveNueva.nombre}</b> creada. Copiala ahora — no se vuelve a mostrar:
          </p>
          <code className={estilos.claveTexto}>{claveNueva.clave}</code>
          <button type="button" className={estilos.cerrarClave} onClick={() => setClaveNueva(null)}>
            Ya la copié, cerrar
          </button>
        </div>
      )}

      {cargando ? (
        <p className={estilos.vacio}>Cargando…</p>
      ) : (
        <div className={estilos.bloque}>
          {claves.length === 0 && <p className={estilos.vacio}>Todavía no hay claves para este proyecto.</p>}

          {claves.length > 0 && (
            <div className={estilos.tablaEnvoltura}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Prefijo</th>
                    <th>Creada</th>
                    <th>Último uso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {claves.map((clave) => (
                    <tr key={clave.id} className={clave.activa ? '' : estilos.revocada}>
                      <td className={estilos.principal}>{clave.nombre}</td>
                      <td>
                        <code className={estilos.prefijo}>{clave.prefijo}…</code>
                      </td>
                      <td className={estilos.fecha}>{fechaCorta(clave.creada_en)}</td>
                      <td className={estilos.fecha}>
                        {clave.ultimo_uso_en ? fechaCorta(clave.ultimo_uso_en) : 'nunca'}
                      </td>
                      <td>
                        {clave.activa ? (
                          <button type="button" className={estilos.accion} onClick={() => revocar(clave)}>
                            revocar
                          </button>
                        ) : (
                          <span className={estilos.chip}>revocada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Oculto mientras `claveNueva` sigue sin cerrar: crear otra ahora
              pisaría en silencio la única copia de la anterior — mejor
              obligar a cerrarla (o sea, a haberla copiado) primero. */}
          {!claveNueva && (
            <form className={estilos.formInline} onSubmit={crearNuevaClave}>
              <input
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Nombre de la clave (ej: Backend API — trazas de agentes)"
                disabled={enviando}
              />
              <button type="submit" disabled={enviando || !nombreNuevo.trim()}>
                + crear clave
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
