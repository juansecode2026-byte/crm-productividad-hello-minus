import { useState, type FormEvent } from 'react';
import { iniciarSesion, registrarse } from '../services/authService';
import estilos from './Login.module.css';

export function Login() {
  const [modo, setModo] = useState<'entrar' | 'registrarse'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registroEnviado, setRegistroEnviado] = useState(false);

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);
    try {
      if (modo === 'entrar') {
        await iniciarSesion(email, password);
      } else {
        await registrarse(email, password);
        setRegistroEnviado(true);
      }
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : 'Ocurrió un error inesperado');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={estilos.contenedor}>
      <div className={estilos.tarjeta}>
        <h1 className={estilos.titulo}>CRM Productividad</h1>
        <p className={estilos.subtitulo}>Hello Minus</p>

        {registroEnviado ? (
          <p className={estilos.aviso}>
            Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión.
          </p>
        ) : (
          <form onSubmit={alEnviar} noValidate>
            {error && (
              <p className={estilos.error} role="alert">
                {error}
              </p>
            )}

            <div className={estilos.campo}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={cargando}
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
              />
            </div>

            <div className={estilos.campo}>
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                disabled={cargando}
                value={password}
                onChange={(evento) => setPassword(evento.target.value)}
              />
            </div>

            <button type="submit" className={estilos.boton} disabled={cargando}>
              {cargando ? 'Un momento...' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        )}

        {!registroEnviado && (
          <button
            type="button"
            className={estilos.cambiarModo}
            disabled={cargando}
            onClick={() => {
              setModo(modo === 'entrar' ? 'registrarse' : 'entrar');
              setError(null);
            }}
          >
            {modo === 'entrar' ? '¿Todavía no tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
          </button>
        )}
      </div>
    </div>
  );
}
