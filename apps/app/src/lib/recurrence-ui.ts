import { toRRule, type SimpleRecurrence } from '@farmhabit/core';
import { WEEKDAYS } from './format';

// Traducción entre las reglas RRULE guardadas y las opciones del formulario.

const BYDAY_TO_ISO: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };

/** null = sin repetición; 'custom' = una regla que el formulario no sabe editar. */
export function parseRRule(rrule: string | null): SimpleRecurrence | 'custom' | null {
  if (!rrule) return null;
  const parts = new Map(
    rrule.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k?.toUpperCase() ?? '', v ?? ''] as const;
    }),
  );
  const known = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY']);
  if ([...parts.keys()].some((k) => !known.has(k))) return 'custom';
  const interval = parts.has('INTERVAL') ? Number(parts.get('INTERVAL')) : 1;
  switch (parts.get('FREQ')) {
    case 'DAILY':
      return { freq: 'daily', interval };
    case 'WEEKLY': {
      const days = (parts.get('BYDAY') ?? '')
        .split(',')
        .map((d) => BYDAY_TO_ISO[d])
        .filter((d): d is number => d !== undefined);
      return { freq: 'weekly', interval, weekdays: days };
    }
    case 'MONTHLY':
      return { freq: 'monthly', interval, monthDay: Number(parts.get('BYMONTHDAY') ?? 1) };
    case 'YEARLY':
      return { freq: 'yearly', interval };
    default:
      return 'custom';
  }
}

export function describeRecurrence(r: SimpleRecurrence | 'custom' | null): string {
  if (r === null) return 'No se repite';
  if (r === 'custom') return 'Repetición personalizada';
  const every = (n: number | undefined, one: string, many: string) =>
    !n || n === 1 ? one : `Cada ${n} ${many}`;
  switch (r.freq) {
    case 'daily':
      return every(r.interval, 'Cada día', 'días');
    case 'weekly': {
      const names = WEEKDAYS.filter((w) => r.weekdays.includes(w.iso)).map((w) =>
        w.name.slice(0, 3).toLowerCase(),
      );
      const base = every(r.interval, 'Cada semana', 'semanas');
      return names.length ? `${base}: ${names.join(', ')}` : base;
    }
    case 'monthly': {
      const day = r.monthDay === -1 ? 'el último día' : `el día ${r.monthDay}`;
      return `${every(r.interval, 'Cada mes', 'meses')}, ${day}`;
    }
    case 'yearly':
      return every(r.interval, 'Cada año', 'años');
  }
}

// Borrador de los controles de repetición de tareas y eventos.

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface RecurrenceDraft {
  repeat: RepeatKind;
  interval: number;
  weekdays: number[];
  monthDay: number;
  /** Regla que no se puede editar con estos controles: se conserva tal cual. */
  customRule: string | null;
}

/** `date`: la fecha que da el día del mes por defecto, si la hay. */
export function recurrenceDraft(rrule: string | null, date?: string): RecurrenceDraft {
  const rec = parseRRule(rrule);
  return {
    repeat: rec === null ? 'none' : rec === 'custom' ? 'custom' : rec.freq,
    interval: rec && rec !== 'custom' ? (rec.interval ?? 1) : 1,
    weekdays: rec && rec !== 'custom' && rec.freq === 'weekly' ? rec.weekdays : [],
    monthDay:
      rec && rec !== 'custom' && rec.freq === 'monthly'
        ? rec.monthDay
        : date
          ? Number(date.slice(8))
          : 1,
    customRule: rec === 'custom' ? rrule : null,
  };
}

function toRecurrence(d: RecurrenceDraft, date: string): SimpleRecurrence | null {
  const interval = Math.max(1, d.interval || 1);
  switch (d.repeat) {
    case 'daily':
      return { freq: 'daily', interval };
    case 'weekly': {
      // Sin días elegidos: el mismo día de la semana que la fecha.
      const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
      return { freq: 'weekly', interval, weekdays: d.weekdays.length ? d.weekdays : [day] };
    }
    case 'monthly':
      return { freq: 'monthly', interval, monthDay: d.monthDay };
    case 'yearly':
      return { freq: 'yearly', interval };
    default:
      return null;
  }
}

/** Regla RRULE del borrador (null si no se repite). `date` es la fecha de la tarea o el evento. */
export function recurrenceRule(d: RecurrenceDraft, date: string): string | null {
  if (d.repeat === 'custom') return d.customRule;
  const rec = toRecurrence(d, date);
  return rec ? toRRule(rec) : null;
}
