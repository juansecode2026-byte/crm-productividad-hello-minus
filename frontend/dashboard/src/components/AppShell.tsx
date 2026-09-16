import { useEffect, useState, type ReactNode } from 'react';
import { cerrarSesion } from '../services/authService';
import { obtenerPersonaActual } from '../services/personasService';
import { useThemeStore } from '../stores/themeStore';
import estilos from './AppShell.module.css';

const nombreRol: Record<string, string> = {
  admin: 'admin',
  lider_proyecto: 'líder de proyecto',
  colaborador: 'colaborador',
};

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
}

// Todavía sin construir: quedan visibles porque anticipan la navegación real
// del CRM, pero marcadas "pronto" en vez de simular que funcionan.
const seccionesPendientes = ['Equipo', 'Actividad', 'Indicadores', 'Ajustes'];

type EstadoPersona = { nombre: string; rol: string } | 'cargando' | 'error';

export function AppShell({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<EstadoPersona>('cargando');
  const { tema, alternar } = useThemeStore();

  useEffect(() => {
    obtenerPersonaActual()
      .then((p) => setPersona(p ?? 'error'))
      .catch(() => setPersona('error'));
  }, []);

  const nombrePersona =
    persona === 'cargando' ? 'Cargando...' : persona === 'error' ? 'Sin datos de sesión' : persona.nombre;
  const rolPersona = persona === 'cargando' || persona === 'error' ? '' : nombreRol[persona.rol];

  return (
    <div className={estilos.app}>
      <aside className={estilos.lateral}>
        <div className={estilos.marca}>
          <div className={estilos.cubo}>HM</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={estilos.nombreOrg}>Hello Minus</div>
            <div className={estilos.subOrg}>productividad</div>
          </div>
          <button
            type="button"
            className={estilos.temaBoton}
            onClick={alternar}
            aria-label={tema === 'dark' ? 'Ver de día' : 'Ver de noche'}
            title={tema === 'dark' ? 'Ver de día' : 'Ver de noche'}
          >
            {tema === 'dark' ? '☀' : '☾'}
          </button>
        </div>

        <nav>
          <button type="button" className={`${estilos.navItem} ${estilos.navItemActivo}`} aria-current="page">
            Proyectos
          </button>
          {seccionesPendientes.map((seccion) => (
            <span key={seccion} className={`${estilos.navItem} ${estilos.navItemPronto}`}>
              {seccion}
              <span className={estilos.etiquetaPronto}>pronto</span>
            </span>
          ))}
        </nav>

        <div className={estilos.usuario}>
          <div className={estilos.avatar}>{typeof persona === 'object' ? iniciales(persona.nombre) : '··'}</div>
          <div style={{ minWidth: 0 }}>
            <div className={estilos.quien}>{nombrePersona}</div>
            <div className={estilos.rol}>{rolPersona}</div>
          </div>
          <button type="button" className={estilos.salir} onClick={() => cerrarSesion()}>
            Salir
          </button>
        </div>
      </aside>

      <main>{children}</main>
    </div>
  );
}
