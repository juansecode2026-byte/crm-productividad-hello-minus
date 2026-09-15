import { useEffect, useState, type FormEvent } from 'react';
import { cerrarSesion } from '../services/authService';
import { crearProyecto, listarProyectos } from '../services/proyectosService';
import type { Proyecto } from '../lib/tipos';
import estilos from './Proyectos.module.css';

const nombreEstado: Record<Proyecto['estado'], string> = {
  activo: 'Activo',
  pausado: 'Pausado',
  archivado: 'Archivado',
};

export function Proyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [modalidad, setModalidad] = useState<'individual' | 'equipo'>('individual');
  const [creando, setCreando] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);

  async function cargar() {
    setErrorLista(null);
    try {
      setProyectos(await listarProyectos());
    } catch (excepcion) {
      setErrorLista(excepcion instanceof Error ? excepcion.message : 'No se pudieron cargar los proyectos');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function alCrear(evento: FormEvent) {
    evento.preventDefault();
    setErrorAlta(null);
    setCreando(true);
    try {
      await crearProyecto({ nombre, modalidad });
      setNombre('');
      await cargar();
    } catch (excepcion) {
      setErrorAlta(excepcion instanceof Error ? excepcion.message : 'No se pudo crear el proyecto');
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className={estilos.pagina}>
      <div className={estilos.cabecera}>
        <h1 className={estilos.titulo}>Proyectos</h1>
        <button type="button" className={estilos.salir} onClick={() => cerrarSesion()}>
          Cerrar sesión
        </button>
      </div>

      <form className={estilos.formulario} onSubmit={alCrear}>
        <div className={estilos.campo}>
          <label htmlFor="nombre-proyecto">Nombre del proyecto</label>
          <input
            id="nombre-proyecto"
            required
            disabled={creando}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
          />
        </div>

        <div className={estilos.campo}>
          <label htmlFor="modalidad-proyecto">Modalidad</label>
          <select
            id="modalidad-proyecto"
            disabled={creando}
            value={modalidad}
            onChange={(evento) => setModalidad(evento.target.value as 'individual' | 'equipo')}
          >
            <option value="individual">Individual</option>
            <option value="equipo">Equipo</option>
          </select>
        </div>

        <button type="submit" className={estilos.boton} disabled={creando}>
          {creando ? 'Creando...' : 'Crear proyecto'}
        </button>

        {errorAlta && (
          <p className={estilos.error} role="alert">
            {errorAlta}
          </p>
        )}
      </form>

      {proyectos === null && !errorLista && <p className={estilos.cargando}>Cargando proyectos...</p>}

      {errorLista && (
        <p className={estilos.error} role="alert">
          {errorLista}
        </p>
      )}

      {proyectos && proyectos.length === 0 && (
        <p className={estilos.vacio}>Todavía no hay proyectos. Creá el primero arriba.</p>
      )}

      {proyectos && proyectos.length > 0 && (
        <ul className={estilos.lista}>
          {proyectos.map((proyecto) => (
            <li key={proyecto.id} className={estilos.tarjetaProyecto}>
              <h2 className={estilos.nombreProyecto}>{proyecto.nombre}</h2>
              <p className={estilos.metaProyecto}>
                {nombreEstado[proyecto.estado]} · Etapa {proyecto.etapa_actual}/9 · {proyecto.modalidad}
                {proyecto.alcance_congelado_en ? ' · alcance congelado' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
