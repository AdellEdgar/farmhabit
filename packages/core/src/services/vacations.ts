import type { Database } from '../db/database';
import type { Vacation } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, diffDays } from '../util/dates';

export class VacationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VacationError';
  }
}

export const MAX_VACATION_DAYS = 30;

/** Programa vacaciones. Tienen que empezar como pronto mañana. */
export async function scheduleVacation(
  db: Database,
  start: LocalDate,
  end: LocalDate,
  today: LocalDate,
): Promise<Vacation> {
  if (start <= today)
    throw new VacationError(
      'Las vacaciones se programan con antelación: como pronto, desde mañana',
    );
  if (end < start) throw new VacationError('La fecha de fin es anterior a la de inicio');
  if (diffDays(start, end) + 1 > MAX_VACATION_DAYS) {
    throw new VacationError(`Como mucho ${MAX_VACATION_DAYS} días seguidos`);
  }
  const overlaps = (await db.repo('vacations').list()).some(
    (v) => v.startDate <= end && start <= v.endDate,
  );
  if (overlaps) throw new VacationError('Ya tienes vacaciones en esas fechas');
  return db.repo('vacations').create({ startDate: start, endDate: end });
}

/**
 * Termina o cancela unas vacaciones. Los días ya cerrados siguen protegidos
 * (si no, cancelar sería una forma de reescribir el pasado).
 */
export async function endVacation(db: Database, id: string, today: LocalDate): Promise<void> {
  const repo = db.repo('vacations');
  const v = await repo.get(id);
  if (!v) return;
  if (v.startDate >= today) {
    await repo.remove(id);
    return;
  }
  const yesterday = addDays(today, -1);
  if (v.endDate > yesterday) await repo.update(id, { endDate: yesterday });
}
