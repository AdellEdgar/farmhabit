import { RRule } from 'rrule';
import type { LocalDate } from '../util/dates';
import { fromUtcMidnight } from '../util/dates';

// Lector de calendarios iCalendar (.ics, RFC 5545): lo justo para mostrar
// eventos de calendarios externos (universidad, Google, Outlook) en solo
// lectura. Soporta líneas partidas, escapes, eventos de día completo,
// TZID (también nombres de zona de Windows), RRULE, EXDATE, RECURRENCE-ID y
// eventos cancelados.

export class IcsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IcsParseError';
  }
}

/** Fecha/hora "de pared" de un evento, en una zona concreta o flotante. */
interface IcsTime {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  allDay: boolean;
  /** 'UTC', una zona IANA, o null = hora local del dispositivo. */
  tz: string | null;
}

export interface IcsEvent {
  uid: string;
  title: string;
  location: string;
  description: string;
  start: IcsTime;
  /** Duración en ms (para día completo: múltiplo de días). */
  durationMs: number;
  rrule: string | null;
  exdates: IcsTime[];
  /** Si es una ocurrencia modificada de una serie: la ocurrencia que sustituye. */
  recurrenceId: IcsTime | null;
  cancelled: boolean;
}

/** Ocurrencia concreta lista para pintar. */
export interface CalendarOccurrence {
  /** Único por ocurrencia. */
  key: string;
  uid: string;
  title: string;
  location: string;
  description: string;
  allDay: boolean;
  /** Instantes en ms (para día completo: medianoche local). */
  start: number;
  end: number;
  /** Día local de inicio (y de fin, incluido) para colocarlo en el calendario. */
  startDate: LocalDate;
  endDate: LocalDate;
}

// Nombres de zona de Windows que usa Outlook → IANA (los más comunes).
const WINDOWS_ZONES: Record<string, string> = {
  'Romance Standard Time': 'Europe/Paris',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'GTB Standard Time': 'Europe/Bucharest',
  'Canary Standard Time': 'Atlantic/Canary',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Pacific Standard Time': 'America/Los_Angeles',
  UTC: 'UTC',
};

function knownZone(tz: string): string | null {
  const name = WINDOWS_ZONES[tz] ?? tz;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return name;
  } catch {
    return null;
  }
}

/** Desplazamiento (ms) de una zona IANA en un instante. */
function zoneOffset(epoch: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(epoch);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

/** Instante (ms) de una fecha/hora de pared. */
export function icsTimeToEpoch(t: IcsTime): number {
  if (t.allDay || t.tz === null) return new Date(t.y, t.m - 1, t.d, t.h, t.mi, t.s).getTime();
  const wall = Date.UTC(t.y, t.m - 1, t.d, t.h, t.mi, t.s);
  if (t.tz === 'UTC') return wall;
  // Dos pasadas para acertar en los cambios de hora.
  let guess = wall - zoneOffset(wall, t.tz);
  guess = wall - zoneOffset(guess, t.tz);
  return guess;
}

function unescapeText(v: string): string {
  return v.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Une las líneas partidas (las que empiezan por espacio o tabulador continúan la anterior). */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Prop | null {
  // NOMBRE;PARAM=valor;PARAM="valor:con:dos puntos":VALOR
  let i = 0;
  let inQuotes = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ':' && !inQuotes) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name = '', ...rawParams] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

function parseTime(prop: Prop): IcsTime {
  const v = prop.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) throw new IcsParseError(`Fecha no válida: ${v}`);
  const allDay = prop.params.VALUE === 'DATE' || m[4] === undefined;
  const tzParam = prop.params.TZID ? knownZone(prop.params.TZID) : null;
  return {
    y: Number(m[1]),
    m: Number(m[2]),
    d: Number(m[3]),
    h: allDay ? 0 : Number(m[4]),
    mi: allDay ? 0 : Number(m[5]),
    s: allDay ? 0 : Number(m[6] ?? 0),
    allDay,
    tz: allDay ? null : m[7] ? 'UTC' : tzParam,
  };
}

function parseDuration(v: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    v.trim(),
  );
  if (!m) return 0;
  const n = (i: number) => Number(m[i] ?? 0);
  const ms = ((n(2) * 7 + n(3)) * 86400 + n(4) * 3600 + n(5) * 60 + n(6)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

/** Lee todos los eventos de un texto .ics. */
export function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text);
  if (!lines.some((l) => l.trim().toUpperCase() === 'BEGIN:VCALENDAR')) {
    throw new IcsParseError('No es un calendario iCalendar (.ics)');
  }
  const events: IcsEvent[] = [];
  let current: Prop[] | null = null;
  let depth = 0; // VALARM y otros componentes dentro del evento

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = [];
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (upper.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (upper.startsWith('END:') && depth > 0) {
      depth--;
      continue;
    }
    if (upper === 'END:VEVENT') {
      const ev = buildEvent(current);
      if (ev) events.push(ev);
      current = null;
      continue;
    }
    if (depth === 0) {
      const prop = parseLine(line);
      if (prop) current.push(prop);
    }
  }
  return events;
}

function buildEvent(props: Prop[]): IcsEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const dtstart = get('DTSTART');
  if (!dtstart) return null;
  const start = parseTime(dtstart);
  const startMs = icsTimeToEpoch(start);
  const dtend = get('DTEND');
  const duration = get('DURATION');
  let durationMs: number;
  if (dtend) durationMs = icsTimeToEpoch(parseTime(dtend)) - startMs;
  else if (duration) durationMs = parseDuration(duration.value);
  else durationMs = start.allDay ? 86_400_000 : 0;

  const exdates = props
    .filter((p) => p.name === 'EXDATE')
    .flatMap((p) => p.value.split(',').map((v) => parseTime({ ...p, value: v })));
  const recurrence = get('RECURRENCE-ID');

  return {
    uid: get('UID')?.value ?? `${start.y}${start.m}${start.d}-${get('SUMMARY')?.value ?? ''}`,
    title: unescapeText(get('SUMMARY')?.value ?? '(Sin título)'),
    location: unescapeText(get('LOCATION')?.value ?? ''),
    description: unescapeText(get('DESCRIPTION')?.value ?? ''),
    start,
    durationMs: Math.max(0, durationMs),
    rrule: get('RRULE')?.value ?? null,
    exdates,
    recurrenceId: recurrence ? parseTime(recurrence) : null,
    cancelled: (get('STATUS')?.value ?? '').toUpperCase() === 'CANCELLED',
  };
}

// --- Expansión de ocurrencias ---------------------------------------------
// Se trabaja en "hora de pared" de la zona del evento, representada como si
// fuera UTC, para que las repeticiones no se desplacen con los cambios de hora.

function wallUtc(t: IcsTime): number {
  return Date.UTC(t.y, t.m - 1, t.d, t.h, t.mi, t.s);
}

function withWall(t: IcsTime, wall: number): IcsTime {
  const d = new Date(wall);
  return {
    ...t,
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
  };
}

function localDate(epoch: number): LocalDate {
  const d = new Date(epoch);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function occurrence(ev: IcsEvent, t: IcsTime): CalendarOccurrence {
  const start = icsTimeToEpoch(t);
  const end = start + ev.durationMs;
  const startDate = t.allDay ? fromUtcMidnight(new Date(wallUtc(t))) : localDate(start);
  // Un evento que acaba justo a medianoche no ocupa el día siguiente.
  const endDate = ev.durationMs > 0 ? localDate(end - 1) : startDate;
  return {
    key: `${ev.uid}|${wallUtc(t)}`,
    uid: ev.uid,
    title: ev.title,
    location: ev.location,
    description: ev.description,
    allDay: t.allDay,
    start,
    end,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
  };
}

/** Máximo de ocurrencias por evento (protege de RRULE infinitas mal formadas). */
const MAX_OCCURRENCES = 2000;

/** Ocurrencias que se solapan con [from, to] (instantes en ms). */
export function expandEvents(events: IcsEvent[], from: number, to: number): CalendarOccurrence[] {
  // Ocurrencias modificadas: sustituyen a la original de su serie.
  const overrides = new Map<string, IcsEvent>();
  for (const ev of events) {
    if (ev.recurrenceId) overrides.set(`${ev.uid}|${wallUtc(ev.recurrenceId)}`, ev);
  }

  const out: CalendarOccurrence[] = [];
  const overlaps = (o: CalendarOccurrence) => o.start <= to && (o.end > from || o.start >= from);
  // Margen para eventos largos que empezaron antes del rango.
  const margin = 40 * 86_400_000;

  for (const ev of events) {
    if (ev.recurrenceId) continue;
    if (!ev.rrule) {
      if (ev.cancelled) continue;
      const o = occurrence(ev, ev.start);
      if (overlaps(o)) out.push(o);
      continue;
    }
    let rule: RRule;
    try {
      rule = new RRule({ ...RRule.parseString(ev.rrule), dtstart: new Date(wallUtc(ev.start)) });
    } catch {
      continue;
    }
    const excluded = new Set(
      ev.exdates.map((x) => fromUtcMidnight(new Date(wallUtc({ ...x, h: 0, mi: 0, s: 0 })))),
    );
    const exactExcluded = new Set(ev.exdates.map(wallUtc));
    let count = 0;
    // El rango se amplía un poco porque las fechas están en hora de pared.
    const walls = rule.between(new Date(from - margin), new Date(to + 86_400_000), true);
    for (const w of walls) {
      if (++count > MAX_OCCURRENCES) break;
      const wall = w.getTime();
      const dayKey = fromUtcMidnight(
        new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate())),
      );
      if (exactExcluded.has(wall) || (ev.start.allDay && excluded.has(dayKey))) continue;
      const override = overrides.get(`${ev.uid}|${wall}`);
      if (override) {
        if (!override.cancelled) {
          const o = occurrence(override, override.start);
          if (overlaps(o)) out.push({ ...o, key: `${ev.uid}|${wall}` });
        }
        continue;
      }
      if (ev.cancelled) continue;
      const o = occurrence(ev, withWall(ev.start, wall));
      if (overlaps(o)) out.push(o);
    }
  }
  return out.sort((a, b) => a.start - b.start || (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1));
}
