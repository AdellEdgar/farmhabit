import type { Priority } from '@farmhabit/core';

/** bars: barras llenas en el icono de cobertura (1 baja, 2 media, 3 alta). */
export const PRIORITIES: { value: Priority; label: string; color: string; bars: number }[] = [
  { value: 1, label: 'Alta', color: 'var(--fh-peligro)', bars: 3 },
  { value: 2, label: 'Media', color: 'var(--fh-aviso)', bars: 2 },
  { value: 3, label: 'Baja', color: 'var(--fh-exito)', bars: 1 },
];

export function priorityMeta(p: Priority) {
  return PRIORITIES.find((x) => x.value === p)!;
}

/** Colores para etiquetas nuevas. */
export const TAG_COLORS = [
  '#7cc46b',
  '#5b9cf0',
  '#e3a33b',
  '#e5534b',
  '#b57edc',
  '#4fc1c6',
  '#e07bb0',
  '#a3a86b',
];

/** Avisos predefinidos (minutos antes). */
export const REMINDER_PRESETS = [0, 10, 30, 60, 120, 1440, 2880, 10080];
