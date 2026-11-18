// Ajustes salvos só no próprio aparelho (localStorage). Nada é enviado para fora.
const KEY = 'acende:settings:v1';

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export const DEFAULTS = {
  mode: 'cores',        // cores | siga | bolhas | dianoite
  volume: 0.6,          // 0 a 1
  sessionMin: 5,        // minutos; 0 = sem limite
  vibration: true,
  calm: prefersReducedMotion(),
  palette: 'auto',      // auto | xbox | playstation
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* modo privado etc. */ }
}
