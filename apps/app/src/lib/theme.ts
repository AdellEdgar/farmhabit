import type { Database, Setting } from '@farmhabit/core';
import { settingId } from '@farmhabit/core';
import {
  applyThemeColors,
  buildTheme,
  CUSTOM_THEMES_SETTING,
  parseCustomThemes,
  PRESET_THEMES,
  type Theme,
} from './themes';

/** 'sistema', el id de un tema predefinido o el de uno personalizado. */
export type ThemeChoice = string;

// El tema elegido es de cada dispositivo: se guarda en `meta` (no se sincroniza).
// Los temas personalizados sí se sincronizan (ajuste `themes.custom`).
const META_KEY = 'theme';

const media = () => window.matchMedia('(prefers-color-scheme: light)');

/** Todos los temas disponibles: predefinidos + personalizados. */
export function allThemes(settings: Setting[]): Theme[] {
  const row = settings.find(
    (s) => s.id === settingId(CUSTOM_THEMES_SETTING) && s.deletedAt === null,
  );
  return [...PRESET_THEMES, ...parseCustomThemes(row?.value ?? null).map(buildTheme)];
}

export function resolveTheme(choice: ThemeChoice, themes: Theme[]): Theme {
  if (choice === 'sistema')
    return themes.find((t) => t.id === (media().matches ? 'claro' : 'oscuro'))!;
  return themes.find((t) => t.id === choice) ?? PRESET_THEMES[0]!;
}

export function applyTheme(choice: ThemeChoice, themes: Theme[]): void {
  applyThemeColors(resolveTheme(choice, themes));
}

export async function loadTheme(db: Database): Promise<ThemeChoice> {
  return (await db.getMeta(META_KEY)) ?? 'oscuro';
}

export async function saveTheme(db: Database, choice: ThemeChoice, themes: Theme[]): Promise<void> {
  await db.setMeta(META_KEY, choice);
  applyTheme(choice, themes);
}

/** Si el tema es "sistema", sigue los cambios del sistema operativo. */
export function watchSystemTheme(
  getChoice: () => ThemeChoice,
  getThemes: () => Theme[],
): () => void {
  const listener = () => {
    if (getChoice() === 'sistema') applyTheme('sistema', getThemes());
  };
  const m = media();
  m.addEventListener('change', listener);
  return () => m.removeEventListener('change', listener);
}
