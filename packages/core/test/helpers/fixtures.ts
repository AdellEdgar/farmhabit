import type { KdfParams } from '../../src/crypto/sodium';
import { Database } from '../../src/db/database';
import type {
  Animal,
  Habit,
  HabitConfig,
  HabitLog,
  Note,
  Task,
  Vacation,
} from '../../src/model/types';
import { ManualClock } from '../../src/util/clock';
import type { LocalDate } from '../../src/util/dates';
import { localDateTimeToEpoch } from '../../src/util/dates';
import { deterministicId, newId } from '../../src/util/ids';
import { NodeSqliteDriver } from './node-sqlite-driver';

/** Argon2id con el mínimo de coste para que los tests vayan rápidos. */
export const TEST_KDF: KdfParams = { opsLimit: 1, memLimitBytes: 8 * 1024 };

/** Instante a las 12:00 de una fecha local (zona de los tests: Europe/Madrid). */
export const noon = (date: LocalDate) => localDateTimeToEpoch(date, '12:00');

export async function openTestDb(now = noon('2026-10-24')) {
  const clock = new ManualClock(now);
  const driver = new NodeSqliteDriver();
  const db = await Database.open(driver, clock);
  return { db, clock, driver };
}

const base = (ts = 1_000) => ({ id: newId(), createdAt: ts, updatedAt: ts, deletedAt: null });

export function makeTask(over: Partial<Task> = {}): Task {
  return {
    ...base(),
    title: 'Tarea',
    notes: '',
    priority: 2,
    status: 'pending',
    dueDate: null,
    dueTime: null,
    rrule: null,
    reminders: [],
    tagIds: [],
    completedAt: null,
    ...over,
  };
}

export function makeHabit(
  over: Partial<Habit> & { config?: Partial<Omit<HabitConfig, 'since'>> } = {},
): Habit {
  const { config, ...rest } = over;
  const startDate = rest.startDate ?? '2026-01-01';
  return {
    ...base(),
    name: 'Hábito',
    description: '',
    icon: '',
    color: '',
    sortKey: 'V',
    startDate,
    configHistory: [
      { since: startDate, effort: 3, schedule: { type: 'daily' }, target: null, ...config },
    ],
    reminders: [],
    archivedAt: null,
    ...rest,
  };
}

export function makeLog(
  habit: Habit,
  date: LocalDate,
  status: HabitLog['status'] = 'done',
  value: number | null = null,
): HabitLog {
  return {
    ...base(),
    id: deterministicId('habitLog', habit.id, date),
    habitId: habit.id,
    date,
    status,
    value,
  };
}

export function makeNote(over: Partial<Note> = {}): Note {
  return {
    ...base(),
    folderId: null,
    title: 'Nota',
    content: '',
    plainText: '',
    tagIds: [],
    pinned: false,
    isPrivate: false,
    privateBlob: null,
    ...over,
  };
}

export function makeAnimal(over: Partial<Animal> = {}): Animal {
  return {
    ...base(),
    name: 'Lola',
    species: 'chicken',
    acquiredOn: '2026-01-01',
    source: 'starter',
    price: 0,
    ...over,
  };
}

export function makeVacation(over: Partial<Vacation> = {}): Vacation {
  return { ...base(), startDate: '2026-01-01', endDate: '2026-01-07', ...over };
}
