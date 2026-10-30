import {
  eachDay,
  localDateTimeToEpoch,
  tasksInRange,
  type AgendaTask,
  type LocalDate,
  type Task,
} from '@farmhabit/core';
import type { SourceEvent } from '../../lib/calendars';
import { formatEventTime } from './calendar-format';

// Eventos de los calendarios suscritos y tareas con fecha, juntos y por día,
// para que todas las vistas (mes, semana, día y agenda) pinten lo mismo.

export type CalendarView = 'mes' | 'semana' | 'dia' | 'agenda';

/** Duración con la que se pinta una tarea con hora en la vista por horas. */
const TASK_MINUTES = 30;

export interface CalendarItem {
  key: string;
  title: string;
  color: string;
  /** Sin hora en este día: evento de día completo, día intermedio de uno largo o tarea sin hora. */
  allDay: boolean;
  /** Tramo de este día en ms (solo si tiene hora). */
  start: number;
  end: number;
  /** Texto de la hora: "10:00 – 11:30", "Todo el día"… */
  time: string;
  /** Hora de inicio corta ("10:00"), vacía si no tiene hora. */
  startTime: string;
  done: boolean;
  event?: SourceEvent;
  task?: AgendaTask;
}

const hhmm = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

function eventItem(e: SourceEvent, day: LocalDate): CalendarItem {
  const dayStart = localDateTimeToEpoch(day, '00:00');
  const dayEnd = dayStart + 86_400_000;
  const start = Math.max(e.start, dayStart);
  const end = Math.min(e.end, dayEnd);
  const allDay = e.allDay || (start <= dayStart && end >= dayEnd);
  return {
    key: `${e.key}|${day}`,
    title: e.title,
    color: e.color,
    allDay,
    start,
    end,
    time: formatEventTime(e, day),
    startTime: allDay ? '' : hhmm.format(start),
    done: false,
    event: e,
  };
}

function taskItem(t: AgendaTask): CalendarItem {
  const time = t.task.dueTime;
  const start = time ? localDateTimeToEpoch(t.date, time) : 0;
  return {
    key: `${t.task.id}|${t.date}`,
    title: t.task.title || 'Sin título',
    color: 'var(--fh-acento)',
    allDay: !time,
    start,
    end: start + TASK_MINUTES * 60_000,
    time: time ? hhmm.format(start) : '',
    startTime: time ? hhmm.format(start) : '',
    done: t.task.status === 'done' && !t.upcoming,
    task: t,
  };
}

/** Primero lo de todo el día (eventos y luego tareas) y después por hora. */
function compare(a: CalendarItem, b: CalendarItem): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.allDay) return Number(!!a.task) - Number(!!b.task) || a.title.localeCompare(b.title);
  return a.start - b.start || a.end - b.end;
}

/** Elementos de cada día entre `from` y `to` (incluidos), ya ordenados. */
export function itemsByDay(
  events: SourceEvent[],
  tasks: Task[],
  from: LocalDate,
  to: LocalDate,
): Map<LocalDate, CalendarItem[]> {
  const map = new Map<LocalDate, CalendarItem[]>();
  const add = (d: LocalDate, item: CalendarItem) => {
    const list = map.get(d);
    if (list) list.push(item);
    else map.set(d, [item]);
  };
  for (const e of events) {
    // Los eventos de varios días aparecen en todos sus días.
    for (const d of eachDay(e.startDate, e.endDate)) {
      if (d >= from && d <= to) add(d, eventItem(e, d));
    }
  }
  for (const t of tasksInRange(tasks, from, to)) add(t.date, taskItem(t));
  for (const list of map.values()) list.sort(compare);
  return map;
}

/**
 * Columnas para los elementos con hora de un día que se solapan: cada uno
 * recibe su columna y cuántas columnas hay en su grupo de solapados.
 */
export function layoutTimed(
  items: CalendarItem[],
): { item: CalendarItem; col: number; cols: number }[] {
  const out: { item: CalendarItem; col: number; cols: number }[] = [];
  let group: { item: CalendarItem; col: number; cols: number }[] = [];
  let colEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const g of group) g.cols = colEnds.length;
    out.push(...group);
    group = [];
    colEnds = [];
  };
  for (const item of [...items].sort((a, b) => a.start - b.start || b.end - a.end)) {
    // Si no se solapa con nada del grupo actual, empieza un grupo nuevo.
    const fresh = item.start >= groupEnd;
    if (fresh) close();
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col === -1) col = colEnds.push(item.end) - 1;
    else colEnds[col] = item.end;
    group.push({ item, col, cols: 0 });
    groupEnd = fresh ? item.end : Math.max(groupEnd, item.end);
  }
  close();
  return out;
}
