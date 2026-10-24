import { addDays, diffDays, toUtcMidnight, type LocalDate } from '@farmhabit/core';

// Formato de fechas en español. Las fechas locales se formatean en UTC
// (son medianoche UTC) para que la zona horaria no cambie el día.

const weekdayShort = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const dayMonthYear = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const clean = (s: string) => s.replace(/\./g, '');

export function formatLongDate(date: LocalDate): string {
  const s = longDate.format(toUtcMidnight(date));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Hoy", "Mañana", "Ayer", "vie 30 oct", "3 ene 2027". */
export function formatRelativeDate(date: LocalDate, today: LocalDate): string {
  const diff = diffDays(today, date);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  const d = toUtcMidnight(date);
  if (date.slice(0, 4) !== today.slice(0, 4)) return clean(dayMonthYear.format(d));
  if (diff > 1 && diff < 7) return clean(`${weekdayShort.format(d)} ${dayMonth.format(d)}`);
  return clean(dayMonth.format(d));
}

export function formatDue(date: LocalDate, time: string | null, today: LocalDate): string {
  const d = formatRelativeDate(date, today);
  return time ? `${d}, ${time}` : d;
}

export function formatDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    epochMs,
  );
}

/** Texto de un aviso: "1 día antes", "2 h antes", "A la hora". */
export function formatOffset(offsetMin: number): string {
  if (offsetMin === 0) return 'A la hora';
  if (offsetMin % 1440 === 0) {
    const d = offsetMin / 1440;
    return d === 1 ? '1 día antes' : d === 7 ? '1 semana antes' : `${d} días antes`;
  }
  if (offsetMin % 60 === 0) return `${offsetMin / 60} h antes`;
  return `${offsetMin} min antes`;
}

export const WEEKDAYS = [
  { iso: 1, short: 'L', name: 'Lunes' },
  { iso: 2, short: 'M', name: 'Martes' },
  { iso: 3, short: 'X', name: 'Miércoles' },
  { iso: 4, short: 'J', name: 'Jueves' },
  { iso: 5, short: 'V', name: 'Viernes' },
  { iso: 6, short: 'S', name: 'Sábado' },
  { iso: 7, short: 'D', name: 'Domingo' },
];

export function tomorrow(today: LocalDate): LocalDate {
  return addDays(today, 1);
}

export function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}
