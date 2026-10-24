import type { Database } from '../db/database';
import { NotFoundError } from '../db/database';
import { nextOccurrence } from '../domain/recurrence';
import type { Task } from '../model/types';
import type { LocalDate } from '../util/dates';
import { maxDate } from '../util/dates';
import { deterministicId } from '../util/ids';

/**
 * Completa una tarea. Si es recurrente, registra la ocurrencia en el historial
 * y mueve la fecha a la siguiente ocurrencia posterior a hoy (las ocurrencias
 * perdidas no se acumulan). Si la serie ha terminado, queda completada.
 */
export async function completeTask(db: Database, taskId: string, today: LocalDate): Promise<Task> {
  const tasks = db.repo('tasks');
  const task = await tasks.get(taskId);
  if (!task) throw new NotFoundError('tasks', taskId);
  const now = db.source.now();

  if (task.rrule && task.dueDate) {
    await db.repo('taskCompletions').put(deterministicId('taskCompletion', task.id, task.dueDate), {
      taskId: task.id,
      occurrenceDate: task.dueDate,
      completedAt: now,
    });
    const next = nextOccurrence(task.rrule, task.dueDate, maxDate(task.dueDate, today));
    if (next) return tasks.update(task.id, { dueDate: next });
  }
  return tasks.update(task.id, { status: 'done', completedAt: now });
}

/** Devuelve una tarea completada a pendientes. */
export async function reopenTask(db: Database, taskId: string): Promise<Task> {
  return db.repo('tasks').update(taskId, { status: 'pending', completedAt: null });
}
