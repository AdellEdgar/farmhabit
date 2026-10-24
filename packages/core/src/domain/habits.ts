import type { Habit, HabitConfig, HabitLog, HabitSchedule } from '../model/types';
import type { LocalDate } from '../util/dates';
import {
  addDays,
  diffDays,
  endOfMonth,
  isoWeekday,
  localDateOf,
  localDateTimeToEpoch,
  startOfMonth,
  startOfWeek,
} from '../util/dates';

// Reglas de calendario de los hábitos: cuándo tocan, configuración vigente
// cada día y rachas. Funciones puras.

/** Configuración vigente en `date` (la última con since <= date). */
export function configOn(habit: Habit, date: LocalDate): HabitConfig | null {
  if (date < habit.startDate) return null;
  let current: HabitConfig | null = null;
  for (const c of habit.configHistory) {
    if (c.since <= date && (!current || c.since >= current.since)) current = c;
  }
  return current ?? habit.configHistory[0] ?? null;
}

export function currentConfig(habit: Habit): HabitConfig {
  return habit.configHistory.reduce((a, b) => (b.since >= a.since ? b : a));
}

/** El hábito existe ese día: empezado y no archivado ni borrado antes. */
export function isActiveOn(habit: Habit, date: LocalDate): boolean {
  if (date < habit.startDate) return false;
  if (habit.archivedAt !== null && date >= localDateOf(habit.archivedAt)) return false;
  if (habit.deletedAt !== null && date >= localDateOf(habit.deletedAt)) return false;
  return true;
}

export function isFlexible(
  schedule: HabitSchedule,
): schedule is Extract<HabitSchedule, { type: 'timesPerWeek' | 'timesPerMonth' }> {
  return schedule.type === 'timesPerWeek' || schedule.type === 'timesPerMonth';
}

/**
 * ¿Toca ese día? Para frecuencias flexibles (N veces por semana/mes) cualquier
 * día vale: se evalúan por periodo (ver periodOf).
 */
export function isScheduledOn(
  schedule: HabitSchedule,
  startDate: LocalDate,
  date: LocalDate,
): boolean {
  switch (schedule.type) {
    case 'daily':
    case 'timesPerWeek':
    case 'timesPerMonth':
      return true;
    case 'weekdays':
      return schedule.days.includes(isoWeekday(date));
    case 'everyNDays':
      return diffDays(startDate, date) % schedule.interval === 0;
  }
}

/** Periodo (semana lunes-domingo o mes) al que pertenece un día. */
export function periodOf(
  schedule: HabitSchedule,
  date: LocalDate,
): { start: LocalDate; end: LocalDate } {
  if (schedule.type === 'timesPerMonth')
    return { start: startOfMonth(date), end: endOfMonth(date) };
  const start = startOfWeek(date);
  return { start, end: addDays(start, 6) };
}

/**
 * Grado de cumplimiento de un registro: 1 si está hecho (o la cantidad llega
 * al objetivo), proporcional si la cantidad no llega, null si se saltó.
 */
export function logRatio(log: HabitLog | undefined, config: HabitConfig): number | null {
  if (!log || log.deletedAt !== null) return 0;
  if (log.status === 'skipped') return null;
  if (!config.target || log.value === null) return 1;
  return Math.min(1, log.value / config.target.quantity);
}

/** Índice de registros vivos por fecha para un hábito. */
export function logsByDate(logs: HabitLog[], habitId: string): Map<LocalDate, HabitLog> {
  const out = new Map<LocalDate, HabitLog>();
  for (const l of logs) if (l.habitId === habitId && l.deletedAt === null) out.set(l.date, l);
  return out;
}

export interface Streak {
  current: number;
  best: number;
  /** Días para frecuencias fijas; semanas o meses para las flexibles. */
  unit: 'days' | 'weeks' | 'months';
}

/**
 * Rachas de un hábito hasta `today`. "Saltado" y los días que no toca no suman
 * ni rompen. Hoy (o el periodo en curso) sin completar no rompe la racha.
 */
export function habitStreak(habit: Habit, logs: HabitLog[], today: LocalDate): Streak {
  const byDate = logsByDate(logs, habit.id);
  const cfg = currentConfig(habit);
  return isFlexible(cfg.schedule)
    ? flexibleStreak(habit, byDate, today)
    : fixedStreak(habit, byDate, today);
}

function fixedStreak(habit: Habit, byDate: Map<LocalDate, HabitLog>, today: LocalDate): Streak {
  let current = 0;
  let best = 0;
  for (let d = habit.startDate; d <= today; d = addDays(d, 1)) {
    const cfg = configOn(habit, d);
    if (!cfg || !isActiveOn(habit, d) || !isScheduledOn(cfg.schedule, habit.startDate, d)) {
      continue;
    }
    const ratio = logRatio(byDate.get(d), cfg);
    if (ratio === null) continue;
    if (ratio >= 1) {
      current++;
      best = Math.max(best, current);
    } else if (d !== today) {
      current = 0;
    }
  }
  return { current, best, unit: 'days' };
}

function flexibleStreak(habit: Habit, byDate: Map<LocalDate, HabitLog>, today: LocalDate): Streak {
  let current = 0;
  let best = 0;
  let unit: Streak['unit'] = 'weeks';
  let d = habit.startDate;
  while (d <= today) {
    const cfg = configOn(habit, d);
    if (!cfg || !isFlexible(cfg.schedule)) {
      d = addDays(d, 1);
      continue;
    }
    unit = cfg.schedule.type === 'timesPerMonth' ? 'months' : 'weeks';
    const { start, end } = periodOf(cfg.schedule, d);
    let count = 0;
    for (let x = start; x <= end && x <= today; x = addDays(x, 1)) {
      const ratio = logRatio(byDate.get(x), cfg);
      // Un día saltado cuenta para el objetivo del periodo.
      if (ratio === null || ratio >= 1) count++;
    }
    const success = count >= cfg.schedule.times;
    if (success) {
      current++;
      best = Math.max(best, current);
    } else if (end < today) {
      current = 0;
    }
    d = addDays(end, 1);
  }
  return { current, best, unit };
}

/** Hábitos que tocan hoy, en su orden manual. */
export function habitsDueOn(habits: Habit[], date: LocalDate): Habit[] {
  return habits
    .filter((h) => {
      const cfg = configOn(h, date);
      return cfg && isActiveOn(h, date) && isScheduledOn(cfg.schedule, h.startDate, date);
    })
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
}

/** Instantes de los recordatorios de un hábito para un día (si toca ese día). */
export function habitReminderInstants(habit: Habit, date: LocalDate): number[] {
  const cfg = configOn(habit, date);
  if (!cfg || !isActiveOn(habit, date) || !isScheduledOn(cfg.schedule, habit.startDate, date)) {
    return [];
  }
  const weekday = isoWeekday(date);
  return habit.reminders
    .filter((r) => r.days.length === 0 || r.days.includes(weekday))
    .map((r) => localDateTimeToEpoch(date, r.time))
    .sort((a, b) => a - b);
}

/**
 * Nueva entrada del historial de configuración. Los cambios se aplican desde
 * mañana para no reescribir el pasado, salvo si el hábito empieza hoy o más tarde.
 */
export function withConfigChange(
  habit: Habit,
  change: Omit<HabitConfig, 'since'>,
  today: LocalDate,
): HabitConfig[] {
  const since = habit.startDate >= today ? habit.startDate : addDays(today, 1);
  const kept = habit.configHistory.filter((c) => c.since < since);
  return [...kept, { ...change, since }];
}
