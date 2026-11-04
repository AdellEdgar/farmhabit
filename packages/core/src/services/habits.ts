import type { Database } from '../db/database';
import { NotFoundError } from '../db/database';
import { withConfigChange } from '../domain/habits';
import type { Habit, HabitConfig, HabitLog } from '../model/types';
import { defaultSpecies, speciesById, type SpeciesId } from '../game/species';
import type { LocalDate } from '../util/dates';
import { addDays, localDateOf } from '../util/dates';
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
  creatureSpecies?: SpeciesId;
  creatureName?: string;
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
    creatureSpecies: input.creatureSpecies ?? null,
    creatureName: input.creatureName ?? '',
    creatureBackground: null,
    creatureAura: null,
    creaturePast: [],
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

/**
 * Cambia la especie de una criatura. La anterior queda en `creaturePast` con la
 * mayor etapa que alcanzó, para que la colección no la olvide.
 */
export async function changeCreatureSpecies(
  db: Database,
  habitId: string,
  species: SpeciesId,
  maxStageEver: number,
): Promise<Habit> {
  const repo = db.repo('habits');
  const habit = await repo.get(habitId);
  if (!habit) throw new NotFoundError('habits', habitId);
  const previous = speciesById(habit.creatureSpecies ?? '')?.id ?? defaultSpecies(habitId);
  if (previous === species && habit.creatureSpecies === species) return habit;
  const known = habit.creaturePast.find((p) => p.species === previous);
  const others = habit.creaturePast.filter((p) => p.species !== previous);
  const maxStage = Math.max(known?.maxStage ?? 0, maxStageEver);
  return repo.update(habitId, {
    creatureSpecies: species,
    creaturePast: maxStage > 0 ? [...others, { species: previous, maxStage }] : others,
  });
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

/**
 * Archiva o reactiva un hábito. Al reactivarlo se apunta en su configuración
 * desde qué día estuvo en pausa: esos días no cuentan como fallos.
 */
export async function setHabitArchived(
  db: Database,
  id: string,
  archived: boolean,
  today: LocalDate,
): Promise<Habit> {
  const repo = db.repo('habits');
  const habit = await repo.get(id);
  if (!habit) throw new NotFoundError('habits', id);
  if (archived)
    return habit.archivedAt === null ? repo.update(id, { archivedAt: db.source.now() }) : habit;
  if (habit.archivedAt === null) return habit;
  const pausedSince = localDateOf(habit.archivedAt);
  const current = habit.configHistory.reduce((a, b) => (b.since >= a.since ? b : a));
  // Si ya hay una configuración que empieza hoy, se le añade la pausa.
  const rest = habit.configHistory.filter((c) => c.since !== today);
  const configHistory =
    pausedSince < today
      ? [...rest, { ...current, since: today, pausedSince }]
      : habit.configHistory;
  return repo.update(id, { archivedAt: null, configHistory });
}
