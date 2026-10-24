import {
  configOn,
  DEFAULT_RULES,
  habitLogId,
  logRatio,
  type Habit,
  type HabitConfig,
  type HabitLog,
  type HabitSchedule,
  type LocalDate,
} from '@farmhabit/core';
import { WEEKDAYS } from '../../lib/format';

export const EFFORT_LABELS: Record<number, string> = {
  1: 'Mínimo',
  2: 'Bajo',
  3: 'Medio',
  4: 'Alto',
  5: 'Máximo',
};

export const HABIT_ICONS = [
  '💧',
  '🏃',
  '📚',
  '🛏️',
  '🧘',
  '🥗',
  '💪',
  '🦷',
  '💊',
  '🎸',
  '✍️',
  '🧹',
  '🌱',
  '😴',
  '🚶',
  '🧠',
];
export const HABIT_COLORS = [
  '#7cc46b',
  '#5b9cf0',
  '#e3a33b',
  '#e5534b',
  '#b57edc',
  '#4fc1c6',
  '#e07bb0',
  '#a3a86b',
];

export function rewardFor(effort: number): number {
  return DEFAULT_RULES.pointsPerEffort * effort;
}

export function penaltyFor(effort: number): number {
  return DEFAULT_RULES.pointsPerEffort * (DEFAULT_RULES.penaltyBase - effort);
}

export function describeSchedule(s: HabitSchedule): string {
  switch (s.type) {
    case 'daily':
      return 'Cada día';
    case 'weekdays': {
      if (s.days.length === 7) return 'Cada día';
      if (s.days.length === 5 && [1, 2, 3, 4, 5].every((d) => s.days.includes(d)))
        return 'Entre semana';
      return WEEKDAYS.filter((w) => s.days.includes(w.iso))
        .map((w) => w.name.slice(0, 3))
        .join(', ');
    }
    case 'timesPerWeek':
      return `${s.times} ${s.times === 1 ? 'vez' : 'veces'} por semana`;
    case 'timesPerMonth':
      return `${s.times} ${s.times === 1 ? 'vez' : 'veces'} al mes`;
    case 'everyNDays':
      return `Cada ${s.interval} días`;
  }
}

/**
 * Progreso visible de un día: hábitos hechos de los que tocan (sin contar los
 * saltados). Incluye los hábitos nuevos, aunque aún no cuenten para la granja.
 */
export function dayProgress(
  habits: Habit[],
  logs: HabitLog[],
  date: LocalDate,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const h of habits) {
    const cfg = configOn(h, date);
    if (!cfg) continue;
    const ratio = logRatio(
      logs.find((l) => l.id === habitLogId(h.id, date)),
      cfg,
    );
    if (ratio === null) continue;
    total++;
    if (ratio >= 1) done++;
  }
  return { done, total };
}

export function streakUnit(unit: 'days' | 'weeks' | 'months', n: number): string {
  if (unit === 'days') return n === 1 ? 'día' : 'días';
  if (unit === 'weeks') return n === 1 ? 'semana' : 'semanas';
  return n === 1 ? 'mes' : 'meses';
}

export function formatQuantity(n: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n);
}

export function sameConfig(a: Omit<HabitConfig, 'since'>, b: Omit<HabitConfig, 'since'>): boolean {
  return (
    JSON.stringify([a.effort, a.schedule, a.target]) ===
    JSON.stringify([b.effort, b.schedule, b.target])
  );
}
