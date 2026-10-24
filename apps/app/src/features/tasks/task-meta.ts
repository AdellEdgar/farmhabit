import type { Priority } from '@farmhabit/core';

export const PRIORITIES: { value: Priority; label: string; color: string; text: string }[] = [
  { value: 1, label: 'Alta', color: 'var(--fh-peligro)', text: 'text-peligro' },
  { value: 2, label: 'Media', color: 'var(--fh-aviso)', text: 'text-aviso' },
  { value: 3, label: 'Baja', color: 'var(--fh-info)', text: 'text-info' },
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
