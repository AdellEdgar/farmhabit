// Fechas "de pared" del usuario. Una LocalDate ('YYYY-MM-DD') significa ese día
// en cualquier zona horaria; no es un instante. La aritmética se hace en UTC
// para que los cambios de hora (DST) no desplacen días.

/** Fecha local 'YYYY-MM-DD'. */
export type LocalDate = string;
/** Hora local 'HH:mm'. */
export type LocalTime = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

export function isLocalDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isLocalTime(value: string): boolean {
  return TIME_RE.test(value);
}

function parts(date: LocalDate): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Fecha no válida: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function fromUtcDate(dt: Date): LocalDate {
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Fecha UTC a medianoche que representa la fecha local (útil para rrule). */
export function toUtcMidnight(date: LocalDate): Date {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromUtcMidnight(dt: Date): LocalDate {
  return fromUtcDate(dt);
}

/** Día local (según la zona horaria del sistema) de un instante en ms. */
export function localDateOf(epochMs: number): LocalDate {
  const dt = new Date(epochMs);
  return `${pad(dt.getFullYear(), 4)}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Instante (ms) de una fecha y hora locales en la zona horaria del sistema. */
export function localDateTimeToEpoch(date: LocalDate, time: LocalTime = '00:00'): number {
  const [y, m, d] = parts(date);
  const t = TIME_RE.exec(time);
  if (!t) throw new Error(`Hora no válida: ${time}`);
  return new Date(y, m - 1, d, Number(t[1]), Number(t[2])).getTime();
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcDate(new Date(toUtcMidnight(date).getTime() + days * DAY_MS));
}

/** Días de `from` a `to` (positivo si `to` es posterior). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / DAY_MS);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(date: LocalDate): number {
  const d = toUtcMidnight(date).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Lunes de la semana de `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** Clave del mes 'YYYY-MM'. */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: LocalDate): LocalDate {
  const [y, m] = parts(date);
  return fromUtcDate(new Date(Date.UTC(y, m, 0)));
}

/** Recorre los días de `from` a `to`, ambos incluidos. */
export function* eachDay(from: LocalDate, to: LocalDate): Generator<LocalDate> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}
