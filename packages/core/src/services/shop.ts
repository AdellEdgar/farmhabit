import type { Database } from '../db/database';
import { AURAS, BACKGROUNDS, DEFAULT_CREATURE_RULES } from '../game/creature-rules';
import type { CreatureRules } from '../game/creature-rules';
import type { GameState } from '../game/creatures';
import type { Purchase, Vacation } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, diffDays } from '../util/dates';

// Acciones del juego que sí son datos: comprar en la tienda y programar
// vacaciones. El resto del estado lo calcula el motor (computeGame).

export class ShopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopError';
  }
}

/** Precio de un artículo de la tienda, o null si no existe. */
export function itemPrice(
  item: string,
  rules: CreatureRules = DEFAULT_CREATURE_RULES,
): number | null {
  if (item === 'freeze') return rules.freezePrice;
  const [kind, id] = item.split(':');
  if (kind === 'background' && (BACKGROUNDS as readonly string[]).includes(id ?? ''))
    return rules.backgroundPrice;
  if (kind === 'aura' && (AURAS as readonly string[]).includes(id ?? '')) return rules.auraPrice;
  return null;
}

/** Compra un comodín ("freeze"), un fondo ("background:playa") o un aura ("aura:dorada"). */
export async function buyItem(
  db: Database,
  item: string,
  game: GameState,
  today: LocalDate,
  rules: CreatureRules = DEFAULT_CREATURE_RULES,
): Promise<Purchase> {
  const price = itemPrice(item, rules);
  if (price === null) throw new ShopError('Ese artículo no está en la tienda');
  if (item === 'freeze') {
    if (game.freezes >= rules.freezeMax)
      throw new ShopError(`Ya tienes ${rules.freezeMax} comodines guardados`);
  } else if (game.owned.includes(item)) {
    throw new ShopError('Ya lo tienes');
  }
  if (game.pesetas < price) throw new ShopError(`Te faltan ${price - game.pesetas} pesetas`);
  return db.repo('purchases').create({ item, date: today, price });
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
    throw new ShopError('Las vacaciones se programan con antelación: como pronto, desde mañana');
  if (end < start) throw new ShopError('La fecha de fin es anterior a la de inicio');
  if (diffDays(start, end) + 1 > MAX_VACATION_DAYS) {
    throw new ShopError(`Como mucho ${MAX_VACATION_DAYS} días seguidos`);
  }
  const overlaps = (await db.repo('vacations').list()).some(
    (v) => v.startDate <= end && start <= v.endDate,
  );
  if (overlaps) throw new ShopError('Ya tienes vacaciones en esas fechas');
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
