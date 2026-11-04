import type { CalendarEvent, Habit, HabitLog, Task } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, localDateOf, localDateTimeToEpoch } from '../util/dates';
import { eventsInRange, type EventOccurrence } from './events';
import { configOn, habitReminderInstants, isFlexible, logRatio, periodOf } from './habits';
import { taskReminderInstants } from './tasks';

// Qué avisos tocan en un intervalo de tiempo. Es puro: la app decide cuándo
// preguntar (cada pocos segundos) y cómo mostrarlos (notificación del sistema).

export type ReminderEvent =
  | { kind: 'task'; key: string; at: number; task: Task; offsetMin: number }
  | { kind: 'habit'; key: string; at: number; habit: Habit; date: LocalDate }
  | { kind: 'event'; key: string; at: number; occurrence: EventOccurrence; offsetMin: number };

export interface ReminderInput {
  tasks: Task[];
  habits: Habit[];
  logs: HabitLog[];
  events?: CalendarEvent[];
  /** Excluido: (from, to]. */
  from: number;
  to: number;
  defaultTaskTime?: string;
}

/** ¿Ya no hace falta recordar el hábito ese día? (hecho, saltado o periodo cumplido) */
function habitSettled(habit: Habit, logs: HabitLog[], date: LocalDate): boolean {
  const cfg = configOn(habit, date);
  if (!cfg) return true;
  const logOf = (d: LocalDate) =>
    logs.find((l) => l.habitId === habit.id && l.date === d && l.deletedAt === null);
  const today = logRatio(logOf(date), cfg);
  if (today === null || today >= 1) return true;
  if (!isFlexible(cfg.schedule)) return false;
  const { start } = periodOf(cfg.schedule, date);
  let count = 0;
  for (let d = start; d < date; d = addDays(d, 1)) {
    const r = logRatio(logOf(d), cfg);
    if (r === null || r >= 1) count++;
  }
  return count >= cfg.schedule.times;
}

/** Avisos con instante en (from, to], ordenados por hora. */
export function remindersBetween(input: ReminderInput): ReminderEvent[] {
  const { from, to } = input;
  if (to <= from) return [];
  const out: ReminderEvent[] = [];

  for (const task of input.tasks) {
    if (task.deletedAt !== null || task.status !== 'pending') continue;
    const base = taskReminderInstants(task, input.defaultTaskTime);
    const offsets = [...new Set(task.reminders.map((r) => r.offsetMin))].sort((a, b) => b - a);
    base.forEach((at, i) => {
      if (at > from && at <= to) {
        out.push({ kind: 'task', key: `task:${task.id}:${at}`, at, task, offsetMin: offsets[i]! });
      }
    });
  }

  const firstDay = localDateOf(from);
  const lastDay = localDateOf(to);
  for (const habit of input.habits) {
    if (habit.deletedAt !== null || habit.archivedAt !== null || habit.reminders.length === 0)
      continue;
    for (let date = firstDay; date <= lastDay; date = addDays(date, 1)) {
      const instants = habitReminderInstants(habit, date).filter((at) => at > from && at <= to);
      if (instants.length === 0 || habitSettled(habit, input.logs, date)) continue;
      for (const at of instants) {
        out.push({ kind: 'habit', key: `habit:${habit.id}:${at}`, at, habit, date });
      }
    }
  }

  for (const event of input.events ?? []) {
    if (event.deletedAt !== null || event.reminders.length === 0) continue;
    // Un aviso puede sonar días antes de su ocurrencia: mirar hasta el aviso más largo.
    const maxOffset = Math.max(...event.reminders.map((r) => r.offsetMin));
    const horizon = addDays(lastDay, Math.ceil(maxOffset / 1440));
    for (const occurrence of eventsInRange([event], firstDay, horizon)) {
      // Como las tareas sin hora, el de día completo cuenta desde la hora por defecto.
      const base = event.allDay
        ? localDateTimeToEpoch(occurrence.startDate, input.defaultTaskTime ?? '09:00')
        : occurrence.start;
      for (const { offsetMin } of event.reminders) {
        const at = base - offsetMin * 60_000;
        if (at > from && at <= to) {
          const key = `event|${occurrence.key}|${offsetMin}`;
          out.push({ kind: 'event', key, at, occurrence, offsetMin });
        }
      }
    }
  }

  return out.sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1));
}
