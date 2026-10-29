import type { Task } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, endOfMonth, startOfWeek } from '../util/dates';
import { occurrencesBetween } from './recurrence';

// Funciones para la vista de calendario: la cuadrícula del mes y las tareas
// que caen en un rango (incluidas las futuras repeticiones).

/** Los 42 días (6 semanas, de lunes a domingo) que muestra un mes. */
export function monthGrid(month: string): LocalDate[] {
  const first = startOfWeek(`${month}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month: string): { from: LocalDate; to: LocalDate } {
  return { from: `${month}-01`, to: endOfMonth(`${month}-01`) };
}

export interface AgendaTask {
  task: Task;
  date: LocalDate;
  /** Repetición futura de una tarea recurrente (aún no es su fecha actual). */
  upcoming: boolean;
}

/** Tareas con fecha en [from, to]: pendientes, hechas y repeticiones futuras. */
export function tasksInRange(tasks: Task[], from: LocalDate, to: LocalDate): AgendaTask[] {
  const out: AgendaTask[] = [];
  for (const task of tasks) {
    if (task.deletedAt !== null || !task.dueDate) continue;
    if (task.dueDate >= from && task.dueDate <= to)
      out.push({ task, date: task.dueDate, upcoming: false });
    if (task.rrule && task.status === 'pending') {
      try {
        for (const date of occurrencesBetween(task.rrule, task.dueDate, from, to)) {
          if (date > task.dueDate) out.push({ task, date, upcoming: true });
        }
      } catch {
        // Regla no válida: solo se muestra la fecha actual.
      }
    }
  }
  return out.sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      (a.task.dueTime ?? '99').localeCompare(b.task.dueTime ?? '99') ||
      a.task.priority - b.task.priority,
  );
}
