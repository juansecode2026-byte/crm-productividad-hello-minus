import { create } from 'zustand';

type Tema = 'light' | 'dark';

function temaGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem('tema');
    return valor === 'light' || valor === 'dark' ? valor : null;
  } catch {
    return null;
  }
}

function temaDelSistema(): Tema {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute('data-theme', tema);
}

interface ThemeState {
  tema: Tema;
  alternar: () => void;
}

// Arranca del valor guardado por este navegador o, si nunca se tocó, del
// tema del sistema — y lo aplica antes del primer render para que no haya
// parpadeo del tema por defecto.
const temaInicial = temaGuardado() ?? temaDelSistema();
aplicarTema(temaInicial);

export const useThemeStore = create<ThemeState>((set, get) => ({
  tema: temaInicial,
  alternar: () => {
    const nuevo: Tema = get().tema === 'dark' ? 'light' : 'dark';
    aplicarTema(nuevo);
    try {
      localStorage.setItem('tema', nuevo);
    } catch {
      // Privado/bloqueado: el toggle sigue funcionando, solo no se recuerda.
    }
    set({ tema: nuevo });
  },
}));
