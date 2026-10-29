import type { Habit, HabitLog } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays } from '../util/dates';
import { configOn, isActiveOn, isFlexible, isScheduledOn, logRatio } from './habits';

// Estadísticas de hábitos para el calendario y las gráficas.

export type DayStatus =
  | 'done' // hecho (o cantidad completa)
  | 'partial' // cantidad a medias
  | 'skipped'
  | 'missed' // tocaba y no se hizo (solo días ya pasados)
  | 'pending' // hoy, aún sin hacer
  | 'off'; // no tocaba, no existía o es futuro

/** Estado de un hábito en cada día del rango (ambos incluidos). */
export function habitCalendar(
  habit: Habit,
  logs: HabitLog[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
): { date: LocalDate; status: DayStatus }[] {
  const byDate = new Map(
    logs.filter((l) => l.habitId === habit.id && l.deletedAt === null).map((l) => [l.date, l]),
  );
  const out: { date: LocalDate; status: DayStatus }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const cfg = configOn(habit, d);
    if (!cfg || d > today || !isActiveOn(habit, d)) {
      out.push({ date: d, status: 'off' });
      continue;
    }
    const log = byDate.get(d);
    const ratio = logRatio(log, cfg);
    let status: DayStatus;
    if (ratio === null) status = 'skipped';
    else if (ratio >= 1) status = 'done';
    else if (ratio > 0) status = 'partial';
    else if (isFlexible(cfg.schedule) || !isScheduledOn(cfg.schedule, habit.startDate, d))
      status = 'off';
    else status = d === today ? 'pending' : 'missed';
    out.push({ date: d, status });
  }
  return out;
}

/** Porcentaje de días hechos sobre los que tocaban (sin contar saltados ni hoy pendiente). */
export function completionRate(calendar: { status: DayStatus }[]): number | null {
  let done = 0;
  let total = 0;
  for (const { status } of calendar) {
    if (status === 'done') {
      done++;
      total++;
    } else if (status === 'partial' || status === 'missed') {
      total++;
    }
  }
  return total === 0 ? null : done / total;
}

/** Hábitos hechos y que tocaban cada día, para la gráfica diaria. */
export function dailyCompletion(
  habits: Habit[],
  logs: HabitLog[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
): { date: LocalDate; done: number; total: number }[] {
  const calendars = habits.map((h) => habitCalendar(h, logs, from, to, today));
  const out: { date: LocalDate; done: number; total: number }[] = [];
  let i = 0;
  for (let d = from; d <= to; d = addDays(d, 1), i++) {
    let done = 0;
    let total = 0;
    for (const cal of calendars) {
      const s = cal[i]!.status;
      if (s === 'done') done++;
      if (s === 'done' || s === 'partial' || s === 'missed' || s === 'pending') total++;
    }
    out.push({ date: d, done, total });
  }
  return out;
}
