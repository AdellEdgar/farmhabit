import type { Database } from '../db/database';
import { NotFoundError } from '../db/database';
import { withConfigChange } from '../domain/habits';
import type { Habit, HabitConfig, HabitLog } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays } from '../util/dates';
import { compareSortKey, keyBetween } from '../util/fractional-index';
import { deterministicId } from '../util/ids';

export class ClosedDayError extends Error {
  constructor(date: LocalDate) {
    super(`El día ${date} ya está cerrado y no se puede modificar`);
    this.name = 'ClosedDayError';
  }
}

/** Id del registro de un hábito en un día: igual en todos los dispositivos. */
export function habitLogId(habitId: string, date: LocalDate): string {
  return deterministicId('habitLog', habitId, date);
}

/** Solo se puede registrar hoy y ayer: los días anteriores están cerrados. */
export function isEditableDay(date: LocalDate, today: LocalDate): boolean {
  return date === today || date === addDays(today, -1);
}

export type HabitLogInput =
  { status: 'done'; value?: number | null } | { status: 'skipped' } | { status: 'none' };

/** Marca, salta o desmarca un hábito en un día (desmarcar = tombstone). */
export async function setHabitLog(
  db: Database,
  habitId: string,
  date: LocalDate,
  input: HabitLogInput,
  today: LocalDate,
): Promise<HabitLog | null> {
  if (!isEditableDay(date, today)) throw new ClosedDayError(date);
  const id = habitLogId(habitId, date);
  const logs = db.repo('habitLogs');
  if (input.status === 'none') {
    await logs.remove(id);
    return null;
  }
  return logs.put(id, {
    habitId,
    date,
    status: input.status,
    value: input.status === 'done' ? (input.value ?? null) : null,
  });
}

export interface NewHabitInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  startDate: LocalDate;
  config: Omit<HabitConfig, 'since'>;
  reminders?: Habit['reminders'];
}

/** Crea un hábito al final de la lista. */
export async function createHabit(db: Database, input: NewHabitInput): Promise<Habit> {
  const repo = db.repo('habits');
  const existing = (await repo.list()).sort(compareSortKey);
  const last = existing[existing.length - 1];
  return repo.create({
    name: input.name,
    description: input.description ?? '',
    icon: input.icon ?? '',
    color: input.color ?? '',
    sortKey: keyBetween(last?.sortKey ?? null, null),
    startDate: input.startDate,
    configHistory: [{ ...input.config, since: input.startDate }],
    reminders: input.reminders ?? [],
    archivedAt: null,
  });
}

/** Cambia esfuerzo/frecuencia/objetivo sin reescribir el pasado. */
export async function changeHabitConfig(
  db: Database,
  habitId: string,
  change: Omit<HabitConfig, 'since'>,
  today: LocalDate,
): Promise<Habit> {
  const repo = db.repo('habits');
  const habit = await repo.get(habitId);
  if (!habit) throw new NotFoundError('habits', habitId);
  return repo.update(habitId, { configHistory: withConfigChange(habit, change, today) });
}

/** Mueve un hábito entre otros dos (null = al principio / al final). */
export async function moveHabit(
  db: Database,
  habitId: string,
  beforeId: string | null,
  afterId: string | null,
): Promise<Habit> {
  const repo = db.repo('habits');
  const before = beforeId ? await repo.get(beforeId) : null;
  const after = afterId ? await repo.get(afterId) : null;
  const lo = before?.sortKey ?? null;
  let hi = after?.sortKey ?? null;
  // Caso raro: dos dispositivos generaron la misma clave. Se coloca tras `before`.
  if (lo !== null && hi !== null && lo >= hi) hi = null;
  return repo.update(habitId, { sortKey: keyBetween(lo, hi) });
}
