import { useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Login } from './pages/Login';
import { Proyectos } from './pages/Proyectos';
import { useAuthStore } from './stores/authStore';

export function App() {
  const { session, cargando, setSession, terminarCarga } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      terminarCarga();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, terminarCarga]);

  if (cargando) return null;

  return session ? <Proyectos /> : <Login />;
}
