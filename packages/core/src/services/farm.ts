import type { Database } from '../db/database';
import type { FarmState } from '../game/engine';
import type { GameRules } from '../game/game-rules';
import { DEFAULT_RULES } from '../game/game-rules';
import { speciesSchema } from '../model/schemas';
import type { Animal, Species, Vacation } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, diffDays } from '../util/dates';

// Acciones de la granja que sí son datos: comprar animales y programar
// vacaciones. El resto del estado lo calcula el motor (computeFarm).

export class FarmActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FarmActionError';
  }
}

export interface ShopOffer {
  species: Species;
  price: number;
  unlockLevel: number;
  unlocked: boolean;
  affordable: boolean;
}

export const ALL_SPECIES = speciesSchema.options;

export function shopOffers(farm: FarmState, rules: GameRules = DEFAULT_RULES): ShopOffer[] {
  return ALL_SPECIES.map((species) => ({
    species,
    price: rules.speciesPrice[species],
    unlockLevel: rules.speciesUnlockLevel[species],
    unlocked: farm.level >= rules.speciesUnlockLevel[species],
    affordable: farm.grain >= rules.speciesPrice[species],
  }));
}

export function aliveCount(farm: FarmState): number {
  return farm.animals.filter((a) => a.diedOn === null).length;
}

export function hasRoom(farm: FarmState, rules: GameRules = DEFAULT_RULES): boolean {
  return aliveCount(farm) < rules.capacity(farm.level);
}

/** Compra un animal con grano. El motor descuenta el precio el día de la compra. */
export async function buyAnimal(
  db: Database,
  farm: FarmState,
  species: Species,
  name: string,
  rules: GameRules = DEFAULT_RULES,
): Promise<Animal> {
  const offer = shopOffers(farm, rules).find((o) => o.species === species);
  if (!offer) throw new FarmActionError('Ese animal no existe');
  if (!offer.unlocked) throw new FarmActionError(`Se desbloquea en el nivel ${offer.unlockLevel}`);
  if (!offer.affordable) throw new FarmActionError('No tienes grano suficiente');
  if (!hasRoom(farm, rules)) {
    throw new FarmActionError('La granja está llena: sube de nivel para tener más espacio');
  }
  const clean = name.trim();
  if (!clean) throw new FarmActionError('Ponle un nombre');
  return db.repo('animals').create({
    name: clean,
    species,
    acquiredOn: farm.today,
    source: 'bought',
    price: offer.price,
  });
}

/** Máximo de días seguidos de vacaciones. */
export const MAX_VACATION_DAYS = 30;

/** Programa vacaciones. Tienen que empezar como pronto mañana. */
export async function scheduleVacation(
  db: Database,
  start: LocalDate,
  end: LocalDate,
  today: LocalDate,
): Promise<Vacation> {
  if (start <= today)
    throw new FarmActionError(
      'Las vacaciones se programan con antelación: como pronto, desde mañana',
    );
  if (end < start) throw new FarmActionError('La fecha de fin es anterior a la de inicio');
  if (diffDays(start, end) + 1 > MAX_VACATION_DAYS) {
    throw new FarmActionError(`Como mucho ${MAX_VACATION_DAYS} días seguidos`);
  }
  const overlaps = (await db.repo('vacations').list()).some(
    (v) => v.startDate <= end && start <= v.endDate,
  );
  if (overlaps) throw new FarmActionError('Ya tienes vacaciones en esas fechas');
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
