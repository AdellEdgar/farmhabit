import { describe, expect, it } from 'vitest';
import {
  InvalidRecurrenceError,
  nextOccurrence,
  occurrencesBetween,
  toRRule,
  validateRRule,
} from '../src/domain/recurrence';
import {
  completedTasks,
  isOverdue,
  sortTasks,
  taskReminderInstants,
  todayTasks,
  upcomingTasks,
} from '../src/domain/tasks';
import { completeTask, reopenTask } from '../src/services/tasks';
import { localDateTimeToEpoch } from '../src/util/dates';
import { makeTask, noon, openTestDb } from './helpers/fixtures';

const TODAY = '2026-10-24';

describe('vistas de tareas', () => {
  const overdue = makeTask({ title: 'vencida', dueDate: '2026-10-20' });
  const today = makeTask({ title: 'hoy', dueDate: TODAY });
  const tomorrow = makeTask({ title: 'mañana', dueDate: '2026-10-25' });
  const noDate = makeTask({ title: 'sin fecha' });
  const done = makeTask({ title: 'hecha', dueDate: TODAY, status: 'done', completedAt: 5 });
  const deleted = makeTask({ title: 'borrada', dueDate: TODAY, deletedAt: 9 });
  const all = [overdue, today, tomorrow, noDate, done, deleted];

  it('Hoy incluye las vencidas y las de hoy pendientes', () => {
    expect(todayTasks(all, TODAY).map((t) => t.title)).toEqual(['vencida', 'hoy']);
  });

  it('Próximas son las pendientes con fecha posterior', () => {
    expect(upcomingTasks(all, TODAY).map((t) => t.title)).toEqual(['mañana']);
  });

  it('Completadas no incluye las borradas', () => {
    expect(completedTasks(all).map((t) => t.title)).toEqual(['hecha']);
  });

  it('una tarea de hoy a las 23:59 cambia de vista justo a medianoche', () => {
    const late = makeTask({ dueDate: TODAY, dueTime: '23:59' });
    expect(todayTasks([late], TODAY)).toHaveLength(1);
    expect(upcomingTasks([late], '2026-10-23')).toHaveLength(1);
    const before = localDateTimeToEpoch(TODAY, '23:58');
    expect(isOverdue(late, before)).toBe(false);
    expect(isOverdue(late, before + 2 * 60_000)).toBe(true);
  });
});

describe('orden de tareas', () => {
  const now = noon(TODAY);

  it('por defecto: fecha, luego prioridad; sin fecha al final', () => {
    const a = makeTask({ title: 'baja-hoy', dueDate: TODAY, priority: 3 });
    const b = makeTask({ title: 'alta-hoy', dueDate: TODAY, priority: 1 });
    const c = makeTask({ title: 'ayer', dueDate: '2026-10-23', priority: 3 });
    const d = makeTask({ title: 'sin-fecha', priority: 1 });
    const e = makeTask({ title: 'hoy-10h', dueDate: TODAY, dueTime: '10:00', priority: 3 });
    expect(sortTasks([a, b, c, d, e], 'dueDate', now).map((t) => t.title)).toEqual([
      'ayer',
      'hoy-10h',
      'alta-hoy',
      'baja-hoy',
      'sin-fecha',
    ]);
  });

  it('inteligente: una alta en 2 días va antes que una baja mañana', () => {
    // Horas restantes / peso: alta 48 h / 3 = 16 < baja 24 h / 1 = 24.
    const lowSoon = makeTask({
      title: 'baja-mañana',
      dueDate: '2026-10-25',
      dueTime: '12:00',
      priority: 3,
    });
    const highLater = makeTask({
      title: 'alta-2d',
      dueDate: '2026-10-26',
      dueTime: '12:00',
      priority: 1,
    });
    const overdue = makeTask({ title: 'vencida', dueDate: '2026-10-22', priority: 3 });
    const noDate = makeTask({ title: 'sin-fecha', priority: 1 });
    const sorted = sortTasks([noDate, lowSoon, highLater, overdue], 'smart', now);
    expect(sorted.map((t) => t.title)).toEqual(['vencida', 'alta-2d', 'baja-mañana', 'sin-fecha']);
  });
});

describe('avisos de tareas', () => {
  it('calcula varios avisos ordenados y sin duplicados', () => {
    const t = makeTask({
      dueDate: TODAY,
      dueTime: '18:00',
      reminders: [{ offsetMin: 60 }, { offsetMin: 1440 }, { offsetMin: 60 }],
    });
    const due = localDateTimeToEpoch(TODAY, '18:00');
    expect(taskReminderInstants(t)).toEqual([due - 1440 * 60_000, due - 60 * 60_000]);
  });

  it('sin hora usa la hora por defecto; completada o sin fecha no avisa', () => {
    const t = makeTask({ dueDate: TODAY, reminders: [{ offsetMin: 0 }] });
    expect(taskReminderInstants(t)).toEqual([localDateTimeToEpoch(TODAY, '09:00')]);
    expect(taskReminderInstants({ ...t, status: 'done' })).toEqual([]);
    expect(taskReminderInstants({ ...t, dueDate: null })).toEqual([]);
  });
});

describe('recurrencias', () => {
  it('genera reglas RRULE desde la UI', () => {
    expect(toRRule({ freq: 'weekly', weekdays: [3, 1] })).toBe('FREQ=WEEKLY;BYDAY=MO,WE');
    expect(toRRule({ freq: 'monthly', monthDay: -1 })).toBe('FREQ=MONTHLY;BYMONTHDAY=-1');
    expect(toRRule({ freq: 'daily', interval: 3 })).toBe('FREQ=DAILY;INTERVAL=3');
  });

  it('cada lunes y miércoles', () => {
    const rule = 'FREQ=WEEKLY;BYDAY=MO,WE';
    expect(nextOccurrence(rule, '2026-10-19', '2026-10-19')).toBe('2026-10-21');
    expect(nextOccurrence(rule, '2026-10-21', '2026-10-21')).toBe('2026-10-26');
  });

  it('el día 1 de cada mes y el último día del mes (años bisiestos)', () => {
    expect(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=1', '2026-10-01', '2026-10-01')).toBe(
      '2026-11-01',
    );
    expect(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=-1', '2028-01-31', '2028-01-31')).toBe(
      '2028-02-29',
    );
  });

  it('el día 31 se salta los meses que no lo tienen (usar -1 para "último día")', () => {
    expect(nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=31', '2026-10-31', '2026-10-31')).toBe(
      '2026-12-31',
    );
  });

  it('cada 2 semanas mantiene el ritmo', () => {
    expect(nextOccurrence('FREQ=WEEKLY;INTERVAL=2', '2026-10-05', '2026-10-05')).toBe('2026-10-19');
  });

  it('UNTIL termina la serie', () => {
    expect(nextOccurrence('FREQ=DAILY;UNTIL=20261025T000000Z', '2026-10-25', '2026-10-25')).toBe(
      null,
    );
  });

  it('lista ocurrencias para el calendario', () => {
    expect(
      occurrencesBetween('FREQ=WEEKLY;BYDAY=SA', '2026-10-03', '2026-10-01', '2026-10-31'),
    ).toEqual(['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']);
  });

  it('rechaza reglas no válidas o con COUNT', () => {
    expect(() => validateRRule('FREQ=WEEKLY;COUNT=3')).toThrow(InvalidRecurrenceError);
    expect(() => validateRRule('BYDAY=MO')).toThrow(InvalidRecurrenceError);
  });
});

describe('completar tareas', () => {
  it('una tarea normal pasa a completadas y se puede reabrir', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const t = await db.repo('tasks').create({ ...makeTask(), id: undefined });
    const done = await completeTask(db, t.id, TODAY);
    expect(done.status).toBe('done');
    expect(done.completedAt).toBe(noon(TODAY));
    expect((await reopenTask(db, t.id)).status).toBe('pending');
  });

  it('una recurrente avanza a la siguiente ocurrencia y guarda el historial', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const t = await db.repo('tasks').create({
      ...makeTask({ dueDate: '2026-10-19', rrule: 'FREQ=WEEKLY;BYDAY=MO' }),
      id: undefined,
    });
    // Vencida desde el lunes 19: se completa el sábado 24 → siguiente lunes 26.
    const next = await completeTask(db, t.id, TODAY);
    expect(next.status).toBe('pending');
    expect(next.dueDate).toBe('2026-10-26');
    const history = await db.repo('taskCompletions').list();
    expect(history.map((c) => c.occurrenceDate)).toEqual(['2026-10-19']);
  });

  it('una recurrente cuya serie terminó queda completada', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const t = await db.repo('tasks').create({
      ...makeTask({ dueDate: TODAY, rrule: 'FREQ=DAILY;UNTIL=20261024T000000Z' }),
      id: undefined,
    });
    expect((await completeTask(db, t.id, TODAY)).status).toBe('done');
  });
});
