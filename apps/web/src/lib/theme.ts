export type Theme = 'light' | 'dark' | 'system';

const KEY = 'agendei_theme';

export function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    // Quem nunca escolheu abre no tema claro; "Automático" só vale se a pessoa escolheu.
    return t === 'light' || t === 'dark' || t === 'system' ? t : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* modo privado: tema só nesta sessão */
  }
}

/** Roda antes da pintura para não piscar o tema errado. */
export const themeInitScript = `var r=document.documentElement;try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')r.setAttribute('data-theme',t);else if(t!=='system')r.setAttribute('data-theme','light')}catch(e){r.setAttribute('data-theme','light')}`;
