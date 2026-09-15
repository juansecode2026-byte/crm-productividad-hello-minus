import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  session: Session | null;
  cargando: boolean;
  setSession: (session: Session | null) => void;
  terminarCarga: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  // Empieza en true: hasta que Supabase confirme si hay sesión guardada, no
  // se sabe si mostrar login o el dashboard.
  cargando: true,
  setSession: (session) => set({ session }),
  terminarCarga: () => set({ cargando: false }),
}));
