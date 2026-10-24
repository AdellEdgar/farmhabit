import { RRule } from 'rrule';
import type { LocalDate } from '../util/dates';
import { fromUtcMidnight, toUtcMidnight } from '../util/dates';

// Recurrencias de tareas en formato RRULE (RFC 5545), el mismo de los .ics.
// Las fechas son de pared: se representan como medianoche UTC para que rrule
// no aplique zonas horarias.

export class InvalidRecurrenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRecurrenceError';
  }
}

/** Frecuencias que ofrece la UI. */
export type SimpleRecurrence =
  | { freq: 'daily'; interval?: number }
  | { freq: 'weekly'; interval?: number; weekdays: number[] }
  | { freq: 'monthly'; interval?: number; monthDay: number }
  | { freq: 'yearly'; interval?: number };

const ISO_TO_BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export function toRRule(r: SimpleRecurrence): string {
  const parts = [`FREQ=${r.freq.toUpperCase()}`];
  if (r.interval && r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'weekly') {
    const days = [...new Set(r.weekdays)].sort().map((d) => ISO_TO_BYDAY[d]);
    parts.push(`BYDAY=${days.join(',')}`);
  }
  // -1 = último día del mes (para "el día 31" en meses cortos usar -1).
  if (r.freq === 'monthly') parts.push(`BYMONTHDAY=${r.monthDay}`);
  return parts.join(';');
}

function buildRule(rrule: string, start: LocalDate): RRule {
  let options;
  try {
    options = RRule.parseString(rrule);
  } catch {
    throw new InvalidRecurrenceError(`Regla de repetición no válida: ${rrule}`);
  }
  if (options.freq === undefined) {
    throw new InvalidRecurrenceError(`La regla no indica FREQ: ${rrule}`);
  }
  // COUNT no tiene sentido porque la fecha de inicio avanza con cada ocurrencia.
  if (options.count != null) {
    throw new InvalidRecurrenceError('COUNT no está soportado; usa UNTIL');
  }
  return new RRule({ ...options, dtstart: toUtcMidnight(start) });
}

export function validateRRule(rrule: string): void {
  buildRule(rrule, '2000-01-01');
}

/**
 * Siguiente ocurrencia estrictamente posterior a `after`, para una serie cuya
 * ocurrencia actual es `current`. null si la serie ha terminado (UNTIL).
 */
export function nextOccurrence(
  rrule: string,
  current: LocalDate,
  after: LocalDate,
): LocalDate | null {
  const next = buildRule(rrule, current).after(toUtcMidnight(after), false);
  return next ? fromUtcMidnight(next) : null;
}

/** Ocurrencias entre dos fechas, ambas incluidas (para el calendario). */
export function occurrencesBetween(
  rrule: string,
  current: LocalDate,
  from: LocalDate,
  to: LocalDate,
): LocalDate[] {
  return buildRule(rrule, current)
    .between(toUtcMidnight(from), toUtcMidnight(to), true)
    .map(fromUtcMidnight);
}
