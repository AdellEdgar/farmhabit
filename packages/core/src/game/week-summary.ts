import type { LocalDate } from '../util/dates';
import { addDays, startOfWeek } from '../util/dates';
import type { GameState } from './creatures';

/**
 * Lunes de la semana cuyo resumen toca enseñar, o null. `seen` es el lunes de la
 * última semana resumida en este dispositivo: sin él (primer arranque) no se
 * enseña nada, para que actualizar la app no saque una semana antigua.
 */
export function summaryToShow(game: GameState, seen: LocalDate | null): LocalDate | null {
  if (seen === null) return null;
  const previous = addDays(startOfWeek(game.today), -7);
  if (previous <= seen) return null;
  const week = game.weeks[previous];
  return week && (week.xp > 0 || week.tasksDone > 0) ? previous : null;
}
