import type { Database } from '@farmhabit/core';

export type ThemeChoice = 'oscuro' | 'claro' | 'sistema';

// El tema elegido es de cada dispositivo: se guarda en `meta` (no se sincroniza).
const META_KEY = 'theme';

const media = () => window.matchMedia('(prefers-color-scheme: light)');

export function applyTheme(choice: ThemeChoice): void {
  const resolved = choice === 'sistema' ? (media().matches ? 'claro' : 'oscuro') : choice;
  document.documentElement.dataset.theme = resolved;
}

export async function loadTheme(db: Database): Promise<ThemeChoice> {
  const v = await db.getMeta(META_KEY);
  return v === 'claro' || v === 'sistema' ? v : 'oscuro';
}

export async function saveTheme(db: Database, choice: ThemeChoice): Promise<void> {
  await db.setMeta(META_KEY, choice);
  applyTheme(choice);
}

/** Si el tema es "sistema", sigue los cambios del sistema operativo. */
export function watchSystemTheme(getChoice: () => ThemeChoice): () => void {
  const listener = () => {
    if (getChoice() === 'sistema') applyTheme('sistema');
  };
  const m = media();
  m.addEventListener('change', listener);
  return () => m.removeEventListener('change', listener);
}
