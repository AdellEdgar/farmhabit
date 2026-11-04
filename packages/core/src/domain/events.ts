import type { CalendarEvent } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, diffDays, isLocalDate, localDateTimeToEpoch } from '../util/dates';
import type { CalendarOccurrence } from './ics';
import { occurrencesBetween } from './recurrence';

// Eventos propios del calendario: se expanden a la misma forma que los eventos
// de los calendarios suscritos, para pintarlos con las mismas vistas.

/** Tope de ocurrencias por evento, como en los calendarios `.ics`. */
const MAX_OCCURRENCES = 2000;

export interface EventOccurrence extends CalendarOccurrence {
  eventId: string;
}

function occurrenceOn(event: CalendarEvent, startDate: LocalDate): EventOccurrence {
  const endDate = addDays(startDate, diffDays(event.startDate, event.endDate));
  return {
    key: `${event.id}|${startDate}`,
    uid: event.id,
    eventId: event.id,
    title: event.title,
    location: event.location,
    description: event.description,
    allDay: event.allDay,
    startDate,
    endDate,
    start: localDateTimeToEpoch(startDate, event.allDay ? '00:00' : (event.startTime ?? '00:00')),
    end: event.allDay
      ? localDateTimeToEpoch(addDays(endDate, 1), '00:00')
      : localDateTimeToEpoch(endDate, event.endTime ?? '23:59'),
  };
}

function startDatesBetween(event: CalendarEvent, from: LocalDate, to: LocalDate): LocalDate[] {
  if (event.rrule) {
    try {
      return occurrencesBetween(event.rrule, event.startDate, from, to);
    } catch {
      // Regla no válida (p. ej. de otra versión): se trata como evento único.
    }
  }
  return event.startDate >= from && event.startDate <= to ? [event.startDate] : [];
}

/** Ocurrencias que se solapan con los días de `from` a `to`, ambos incluidos. */
export function eventsInRange(
  events: CalendarEvent[],
  from: LocalDate,
  to: LocalDate,
): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  for (const event of events) {
    if (event.deletedAt !== null) continue;
    // Una ocurrencia que empezó antes del rango puede seguir dentro de él.
    const span = Math.max(0, diffDays(event.startDate, event.endDate));
    const starts = startDatesBetween(event, addDays(from, -span), to);
    out.push(...starts.slice(0, MAX_OCCURRENCES).map((d) => occurrenceOn(event, d)));
  }
  return out;
}

/** Fin de un evento al mover su inicio: mantiene la duración. Una fecha a medias no lo mueve. */
export function shiftEndDate(from: string, to: string, end: string): string {
  if (!isLocalDate(from) || !isLocalDate(to) || !isLocalDate(end)) return end;
  return addDays(end, diffDays(from, to));
}

const isoWeekday = (d: LocalDate) => new Date(`${d}T12:00:00Z`).getUTCDay() || 7;

/**
 * Lleva la repetición al nuevo día de inicio. Si no, el día elegido dejaría de
 * ser una ocurrencia y el evento desaparecería de él.
 */
export function followStartDate<T extends { weekdays: number[]; monthDay: number }>(
  draft: T,
  from: string,
  to: string,
): T {
  if (!isLocalDate(from) || !isLocalDate(to)) return draft;
  const [oldDay, newDay] = [isoWeekday(from), isoWeekday(to)];
  const weekdays = draft.weekdays.includes(oldDay)
    ? [...new Set(draft.weekdays.map((x) => (x === oldDay ? newDay : x)))]
    : draft.weekdays;
  const monthDay = draft.monthDay === Number(from.slice(8)) ? Number(to.slice(8)) : draft.monthDay;
  return { ...draft, weekdays, monthDay };
}
