import type { SimpleRecurrence } from '@farmhabit/core';
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
