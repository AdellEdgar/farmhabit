import type { LocalDate } from '@farmhabit/core';
import type { SourceEvent } from '../../lib/calendars';

const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

/** "Todo el día", "10:00 – 11:30", o "Desde ayer" / "Hasta mañana" en eventos largos. */
export function formatEventTime(e: SourceEvent, day: LocalDate): string {
  if (e.allDay) return 'Todo el día';
  const starts = e.startDate === day;
  const ends = e.endDate === day;
  if (starts && ends) return `${time.format(e.start)} – ${time.format(e.end)}`;
  if (starts) return `Desde las ${time.format(e.start)}`;
  if (ends) return `Hasta las ${time.format(e.end)}`;
  return 'Todo el día';
}
