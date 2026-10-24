import type { Priority, Task } from '../model/types';
import type { LocalDate } from '../util/dates';
import { localDateTimeToEpoch } from '../util/dates';

// Vistas y orden de las tareas. Funciones puras: reciben la lista y "hoy".

/** Las tareas sin hora cuentan como del final del día. */
const END_OF_DAY = '23:59';

export function dueInstant(task: Pick<Task, 'dueDate' | 'dueTime'>): number | null {
  if (!task.dueDate) return null;
  return localDateTimeToEpoch(task.dueDate, task.dueTime ?? END_OF_DAY);
}

function isActive(t: Task): boolean {
  return t.deletedAt === null && t.status === 'pending';
}

/** Hoy: pendientes que vencen hoy o ya han vencido. */
export function todayTasks(tasks: Task[], today: LocalDate): Task[] {
  return tasks.filter((t) => isActive(t) && t.dueDate !== null && t.dueDate <= today);
}

/** Próximas: pendientes con fecha posterior a hoy. */
export function upcomingTasks(tasks: Task[], today: LocalDate): Task[] {
  return tasks.filter((t) => isActive(t) && t.dueDate !== null && t.dueDate > today);
}

export function pendingTasks(tasks: Task[]): Task[] {
  return tasks.filter(isActive);
}

export function isOverdue(task: Task, now: number): boolean {
  const due = dueInstant(task);
  return task.status === 'pending' && due !== null && due < now;
}

/** Completadas, las más recientes primero. */
export function completedTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.deletedAt === null && t.status === 'done')
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

export function tasksWithTag(tasks: Task[], tagId: string): Task[] {
  return tasks.filter((t) => t.tagIds.includes(tagId));
}

function tieBreak(a: Task, b: Task): number {
  return a.priority - b.priority || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1);
}

/** Orden por defecto: fecha límite (sin fecha al final) y, a igualdad, prioridad. */
export function compareByDueDate(a: Task, b: Task): number {
  const da = dueInstant(a);
  const db = dueInstant(b);
  if (da !== db) {
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  }
  return tieBreak(a, b);
}

const PRIORITY_WEIGHT: Record<Priority, number> = { 1: 3, 2: 2, 3: 1 };
const HOUR = 3_600_000;

/**
 * Puntuación del orden inteligente (menor = antes). Combina urgencia y
 * prioridad: las horas que faltan se dividen por el peso de la prioridad, así
 * una tarea alta para dentro de 3 días va antes que una baja para mañana.
 * Las vencidas van primero (más cuanto más importantes) y las sin fecha al final.
 */
export function smartScore(task: Task, now: number): number {
  const due = dueInstant(task);
  const weight = PRIORITY_WEIGHT[task.priority];
  if (due === null) return 1e9 / weight;
  const hours = (due - now) / HOUR;
  return hours >= 0 ? hours / weight : hours * weight;
}

export function sortTasks(tasks: Task[], mode: 'dueDate' | 'smart', now: number): Task[] {
  const copy = [...tasks];
  if (mode === 'dueDate') return copy.sort(compareByDueDate);
  return copy.sort((a, b) => smartScore(a, now) - smartScore(b, now) || tieBreak(a, b));
}

/** Instantes (ms) en que deben saltar los avisos de una tarea, de antes a después. */
export function taskReminderInstants(task: Task, defaultTime = '09:00'): number[] {
  if (!task.dueDate || task.status !== 'pending' || task.deletedAt !== null) return [];
  const base = localDateTimeToEpoch(task.dueDate, task.dueTime ?? defaultTime);
  return [...new Set(task.reminders.map((r) => base - r.offsetMin * 60_000))].sort((a, b) => a - b);
}
