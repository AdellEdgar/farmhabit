// Temas de color. Cada tema define las variables CSS --fh-* que usa Tailwind
// (ver styles.css). Los personalizados se crean a partir de 4 colores y el
// resto se deriva mezclándolos.

export interface ThemeColors {
  fondo: string;
  superficie: string;
  elevado: string;
  borde: string;
  texto: string;
  textoSuave: string;
  acento: string;
  acentoTexto: string;
  peligro: string;
  aviso: string;
  info: string;
  grano: string;
}

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  colors: ThemeColors;
}

/** Lo que el usuario elige al crear un tema propio. */
export interface CustomThemeInput {
  id: string;
  name: string;
  dark: boolean;
  fondo: string;
  superficie: string;
  texto: string;
  acento: string;
}

export const CUSTOM_THEMES_SETTING = 'themes.custom';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Mezcla `a` con `b` en proporción t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto legible (casi negro o blanco) sobre un color. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.35 ? '#0f1a0c' : '#ffffff';
}

const DARK_STATUS = { peligro: '#e5534b', aviso: '#e3a33b', info: '#5b9cf0', grano: '#e8c15a' };
const LIGHT_STATUS = { peligro: '#c93c37', aviso: '#b97a12', info: '#2f6fc4', grano: '#b88a14' };

export function buildTheme(input: CustomThemeInput): Theme {
  const { fondo, superficie, texto, acento } = input;
  return {
    id: input.id,
    name: input.name,
    dark: input.dark,
    colors: {
      fondo,
      superficie,
      elevado: mix(superficie, texto, 0.05),
      borde: mix(superficie, texto, 0.14),
      texto,
      textoSuave: mix(texto, fondo, 0.42),
      acento,
      acentoTexto: readableOn(acento),
      ...(input.dark ? DARK_STATUS : LIGHT_STATUS),
    },
  };
}

export const PRESET_THEMES: Theme[] = [
  {
    id: 'oscuro',
    name: 'Noche',
    dark: true,
    colors: {
      fondo: '#101318',
      superficie: '#171b22',
      elevado: '#1f252e',
      borde: '#2a313b',
      texto: '#e8ecf1',
      textoSuave: '#8f9aa9',
      acento: '#7cc46b',
      acentoTexto: '#0f1a0c',
      ...DARK_STATUS,
    },
  },
  {
    id: 'claro',
    name: 'Día',
    dark: false,
    colors: {
      fondo: '#f5f3ec',
      superficie: '#ffffff',
      elevado: '#fbfaf6',
      borde: '#e2ded2',
      texto: '#1f2328',
      textoSuave: '#626a74',
      acento: '#3f8f34',
      acentoTexto: '#ffffff',
      ...LIGHT_STATUS,
    },
  },
  buildTheme({
    id: 'bosque',
    name: 'Bosque',
    dark: true,
    fondo: '#0f1a14',
    superficie: '#16251c',
    texto: '#e3efe6',
    acento: '#9bd36f',
  }),
  buildTheme({
    id: 'oceano',
    name: 'Océano',
    dark: true,
    fondo: '#0c1522',
    superficie: '#13203a',
    texto: '#e2ebf7',
    acento: '#4fc1e8',
  }),
  buildTheme({
    id: 'atardecer',
    name: 'Atardecer',
    dark: true,
    fondo: '#1a1215',
    superficie: '#24181d',
    texto: '#f4e6e3',
    acento: '#f29a5b',
  }),
  buildTheme({
    id: 'lavanda',
    name: 'Lavanda',
    dark: false,
    fondo: '#f4f1fa',
    superficie: '#ffffff',
    texto: '#2a2438',
    acento: '#8b6fd6',
  }),
  buildTheme({
    id: 'granja',
    name: 'Granja',
    dark: false,
    fondo: '#f6efe2',
    superficie: '#fffaf0',
    texto: '#3b2f22',
    acento: '#c8553d',
  }),
];

export function parseCustomThemes(json: string | null): CustomThemeInput[] {
  if (!json) return [];
  try {
    const list = JSON.parse(json) as CustomThemeInput[];
    return Array.isArray(list) ? list.filter((t) => t && typeof t.id === 'string') : [];
  } catch {
    return [];
  }
}

const VAR_NAMES: Record<keyof ThemeColors, string> = {
  fondo: '--fh-fondo',
  superficie: '--fh-superficie',
  elevado: '--fh-elevado',
  borde: '--fh-borde',
  texto: '--fh-texto',
  textoSuave: '--fh-texto-suave',
  acento: '--fh-acento',
  acentoTexto: '--fh-acento-texto',
  peligro: '--fh-peligro',
  aviso: '--fh-aviso',
  info: '--fh-info',
  grano: '--fh-grano',
};

/** Aplica un tema poniendo sus variables en <html>. */
export function applyThemeColors(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.dark ? 'oscuro' : 'claro';
  for (const [key, name] of Object.entries(VAR_NAMES) as [keyof ThemeColors, string][]) {
    root.style.setProperty(name, theme.colors[key]);
  }
  root.style.setProperty('--fh-acento-suave', `${theme.colors.acento}26`);
}
