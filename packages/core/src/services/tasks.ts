import type { Database } from '../db/database';
import { NotFoundError } from '../db/database';
import { nextOccurrence } from '../domain/recurrence';
import { subtasksOf } from '../domain/tasks';
import type { Subtask, Task } from '../model/types';
import type { LocalDate } from '../util/dates';
import { maxDate } from '../util/dates';
import { keyBetween } from '../util/fractional-index';
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
    if (next) {
      // La siguiente ocurrencia empieza con las subtareas por hacer.
      for (const s of await taskSubtasks(db, task.id)) {
        if (s.done) await db.repo('subtasks').update(s.id, { done: false });
      }
      return tasks.update(task.id, { dueDate: next });
    }
  }
  return tasks.update(task.id, { status: 'done', completedAt: now });
}

/** Devuelve una tarea completada a pendientes. */
export async function reopenTask(db: Database, taskId: string): Promise<Task> {
  return db.repo('tasks').update(taskId, { status: 'pending', completedAt: null });
}

/** Borra una tarea y sus subtareas. */
export async function deleteTask(db: Database, taskId: string): Promise<void> {
  for (const s of await taskSubtasks(db, taskId)) await db.repo('subtasks').remove(s.id);
  await db.repo('tasks').remove(taskId);
}

// ---------- Subtareas ----------

export class EmptySubtaskError extends Error {
  constructor() {
    super('La subtarea necesita un título');
    this.name = 'EmptySubtaskError';
  }
}

async function taskSubtasks(db: Database, taskId: string): Promise<Subtask[]> {
  return subtasksOf(await db.repo('subtasks').list(), taskId);
}

async function getSubtask(db: Database, id: string): Promise<Subtask> {
  const subtask = await db.repo('subtasks').get(id);
  if (!subtask) throw new NotFoundError('subtasks', id);
  return subtask;
}

/** Añade una subtarea al final de la lista de la tarea. */
export async function addSubtask(db: Database, taskId: string, title: string): Promise<Subtask> {
  const clean = title.trim();
  if (!clean) throw new EmptySubtaskError();
  if (!(await db.repo('tasks').get(taskId))) throw new NotFoundError('tasks', taskId);
  const last = (await taskSubtasks(db, taskId)).at(-1);
  return db.repo('subtasks').create({
    taskId,
    title: clean,
    done: false,
    sortKey: keyBetween(last?.sortKey ?? null, null),
  });
}

export async function renameSubtask(db: Database, id: string, title: string): Promise<Subtask> {
  const clean = title.trim();
  if (!clean) throw new EmptySubtaskError();
  await getSubtask(db, id);
  return db.repo('subtasks').update(id, { title: clean });
}

export interface SubtaskChange {
  task: Task;
  /** La tarea se ha completado sola porque ya están hechas todas sus subtareas. */
  autoCompleted: boolean;
}

/**
 * Si después del cambio todas las subtareas están hechas, completa la tarea
 * (una recurrente pasa a su siguiente fecha con las subtareas por hacer).
 */
async function syncTaskWithSubtasks(
  db: Database,
  taskId: string,
  today: LocalDate,
): Promise<SubtaskChange> {
  const task = await db.repo('tasks').get(taskId);
  if (!task) throw new NotFoundError('tasks', taskId);
  const subtasks = await taskSubtasks(db, taskId);
  if (task.status === 'pending' && subtasks.length > 0 && subtasks.every((s) => s.done)) {
    return { task: await completeTask(db, taskId, today), autoCompleted: true };
  }
  return { task, autoCompleted: false };
}

/**
 * Marca o desmarca una subtarea. Al hacer la última, la tarea se completa
 * sola; al desmarcar una de una tarea completada, la tarea vuelve a pendientes.
 */
export async function setSubtaskDone(
  db: Database,
  id: string,
  done: boolean,
  today: LocalDate,
): Promise<SubtaskChange> {
  const subtask = await getSubtask(db, id);
  if (subtask.done !== done) await db.repo('subtasks').update(id, { done });
  if (!done) {
    const task = await db.repo('tasks').get(subtask.taskId);
    if (!task) throw new NotFoundError('tasks', subtask.taskId);
    return {
      task: task.status === 'done' ? await reopenTask(db, task.id) : task,
      autoCompleted: false,
    };
  }
  return syncTaskWithSubtasks(db, subtask.taskId, today);
}

/** Borra una subtarea. Si las que quedan están todas hechas, la tarea se completa. */
export async function deleteSubtask(
  db: Database,
  id: string,
  today: LocalDate,
): Promise<SubtaskChange> {
  const subtask = await getSubtask(db, id);
  await db.repo('subtasks').remove(id);
  return syncTaskWithSubtasks(db, subtask.taskId, today);
}
