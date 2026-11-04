import { describe, expect, it } from 'vitest';
import { eventsInRange, followStartDate, shiftEndDate } from '../src/domain/events';
import { remindersBetween } from '../src/domain/reminders';
import {
  createEvent,
  deleteEvent,
  EventRangeError,
  taskToEvent,
  TaskToEventError,
  updateEvent,
} from '../src/services/events';
import { addSubtask } from '../src/services/tasks';
import { addDays, localDateTimeToEpoch } from '../src/util/dates';
import { makeEvent, makeHabit, noon, openTestDb } from './helpers/fixtures';

const at = (d: string, t: string) => localDateTimeToEpoch(d, t);

describe('eventos en un rango', () => {
  it('un evento único aparece solo su día', () => {
    const e = makeEvent();
    expect(eventsInRange([e], '2026-09-01', '2026-09-01')).toEqual([
      expect.objectContaining({
        eventId: e.id,
        key: `${e.id}|2026-09-01`,
        start: at('2026-09-01', '10:00'),
        end: at('2026-09-01', '11:00'),
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        allDay: false,
      }),
    ]);
    expect(eventsInRange([e], '2026-09-02', '2026-09-30')).toEqual([]);
  });

  it('uno de dos días aparece en un rango que empieza en su segundo día', () => {
    const e = makeEvent({ endDate: '2026-09-02', endTime: '09:00' });
    expect(eventsInRange([e], '2026-09-02', '2026-09-02')).toHaveLength(1);
  });

  it('el de día completo termina a medianoche del día siguiente', () => {
    const e = makeEvent({ allDay: true, startTime: null, endTime: null });
    const [o] = eventsInRange([e], '2026-09-01', '2026-09-01');
    expect(o).toMatchObject({
      allDay: true,
      start: at('2026-09-01', '00:00'),
      end: at('2026-09-02', '00:00'),
    });
  });

  it('una repetición sigue a su hora tras el cambio de hora', () => {
    const e = makeEvent({
      startDate: '2026-10-19',
      endDate: '2026-10-19',
      startTime: '09:00',
      endTime: '10:00',
      rrule: 'FREQ=WEEKLY',
    });
    const list = eventsInRange([e], '2026-10-01', '2026-10-31');
    expect(list.map((o) => o.startDate)).toEqual(['2026-10-19', '2026-10-26']);
    expect(list[1]!.start).toBe(at('2026-10-26', '09:00'));
  });

  it('una repetición de varios días se ve desde su segundo día', () => {
    const e = makeEvent({ endDate: '2026-09-02', endTime: '09:00', rrule: 'FREQ=WEEKLY' });
    // La ocurrencia del 8 termina el 9.
    expect(eventsInRange([e], '2026-09-09', '2026-09-09').map((o) => o.startDate)).toEqual([
      '2026-09-08',
    ]);
  });

  it('ignora los borrados y una repetición inválida se trata como evento único', () => {
    expect(eventsInRange([makeEvent({ deletedAt: 5 })], '2026-09-01', '2026-09-30')).toEqual([]);
    const bad = makeEvent({ rrule: 'esto no es' });
    expect(eventsInRange([bad], '2026-09-01', '2026-09-30')).toHaveLength(1);
  });

  it('no pasa de 2000 ocurrencias por evento', () => {
    const e = makeEvent({ rrule: 'FREQ=DAILY' });
    expect(eventsInRange([e], '2026-09-01', '2036-09-01')).toHaveLength(2000);
  });
});

describe('avisos de eventos', () => {
  const remind = (e: ReturnType<typeof makeEvent>, from: number, to: number) =>
    remindersBetween({ tasks: [], habits: [], logs: [], events: [e], from, to });

  it('cada ocurrencia de un evento repetido avisa una vez, con su clave', () => {
    const e = makeEvent({
      startTime: '09:00',
      endTime: '10:00',
      rrule: 'FREQ=WEEKLY',
      reminders: [{ offsetMin: 60 }],
    });
    const list = remind(e, at('2026-09-01', '00:00'), at('2026-09-09', '00:00'));
    expect(list.map((r) => r.at)).toEqual([at('2026-09-01', '08:00'), at('2026-09-08', '08:00')]);
    expect(new Set(list.map((r) => r.key)).size).toBe(2);
    expect(list[0]).toMatchObject({ kind: 'event', offsetMin: 60 });
    // Si ya se comprobó después del aviso, no se repite.
    expect(remind(e, at('2026-09-01', '08:30'), at('2026-09-02', '00:00'))).toEqual([]);
  });

  it('el de día completo cuenta desde las 09:00', () => {
    const e = makeEvent({
      allDay: true,
      startTime: null,
      endTime: null,
      reminders: [{ offsetMin: 0 }],
    });
    const [r] = remind(e, at('2026-09-01', '00:00'), at('2026-09-02', '00:00'));
    expect(r?.at).toBe(at('2026-09-01', '09:00'));
  });

  it('un aviso de un día antes cae en el rango de hoy', () => {
    const e = makeEvent({ reminders: [{ offsetMin: 1440 }] });
    const [r] = remind(e, at('2026-08-31', '00:00'), at('2026-08-31', '23:59'));
    expect(r?.at).toBe(at('2026-08-31', '10:00'));
  });

  it('un evento borrado no avisa y los hábitos siguen avisando igual', () => {
    const e = makeEvent({ deletedAt: 5, reminders: [{ offsetMin: 0 }] });
    expect(remind(e, at('2026-09-01', '00:00'), at('2026-09-02', '00:00'))).toEqual([]);
    const h = makeHabit({ startDate: '2026-09-01', reminders: [{ time: '08:00', days: [] }] });
    const without = remindersBetween({
      tasks: [],
      habits: [h],
      logs: [],
      from: at('2026-09-01', '00:00'),
      to: at('2026-09-02', '00:00'),
    });
    expect(without).toHaveLength(1);
  });
});

describe('servicio de eventos', () => {
  const input = {
    title: 'Cita',
    location: '',
    description: '',
    allDay: false,
    startDate: '2026-09-01',
    startTime: '10:00',
    endDate: '2026-09-01',
    endTime: '11:00',
    rrule: null,
    reminders: [],
  };

  it('rechaza un evento que termina antes de empezar o sin título', async () => {
    const { db } = await openTestDb();
    await expect(createEvent(db, { ...input, endTime: '09:00' })).rejects.toBeInstanceOf(
      EventRangeError,
    );
    await expect(createEvent(db, { ...input, endDate: '2026-08-31' })).rejects.toBeInstanceOf(
      EventRangeError,
    );
    await expect(createEvent(db, { ...input, title: '  ' })).rejects.toThrow(/título/);
  });

  it('un evento de día completo guarda las horas a null', async () => {
    const { db } = await openTestDb();
    const e = await createEvent(db, { ...input, allDay: true });
    expect(e).toMatchObject({ allDay: true, startTime: null, endTime: null });
  });

  it('edita y borra', async () => {
    const { db } = await openTestDb();
    const e = await createEvent(db, input);
    expect(await updateEvent(db, e.id, { title: 'Otra' })).toMatchObject({ title: 'Otra' });
    await expect(updateEvent(db, e.id, { endTime: '09:00' })).rejects.toBeInstanceOf(
      EventRangeError,
    );
    await deleteEvent(db, e.id);
    expect(await db.repo('events').list()).toEqual([]);
  });
});

describe('convertir una tarea en evento', () => {
  const task = (db: Awaited<ReturnType<typeof openTestDb>>['db'], over = {}) =>
    db.repo('tasks').create({
      title: 'Médico',
      notes: 'Llevar análisis',
      priority: 2,
      status: 'pending',
      dueDate: '2026-11-10',
      dueTime: '10:00',
      rrule: 'FREQ=MONTHLY',
      reminders: [{ offsetMin: 60 }],
      tagIds: [],
      completedAt: null,
      ...over,
    });

  it('copia los datos, dura una hora y borra la tarea con sus subtareas', async () => {
    const { db } = await openTestDb(noon('2026-11-04'));
    const t = await task(db);
    await addSubtask(db, t.id, 'A');
    const e = await taskToEvent(db, t.id);
    expect(e).toMatchObject({
      title: 'Médico',
      description: 'Llevar análisis',
      allDay: false,
      startDate: '2026-11-10',
      startTime: '10:00',
      endDate: '2026-11-10',
      endTime: '11:00',
      rrule: 'FREQ=MONTHLY',
      reminders: [{ offsetMin: 60 }],
    });
    expect(await db.repo('tasks').list()).toEqual([]);
    expect(await db.repo('subtasks').list()).toEqual([]);
  });

  it('a las 23:30 termina a las 23:59 y sin hora es de día completo', async () => {
    const { db } = await openTestDb(noon('2026-11-04'));
    const late = await taskToEvent(db, (await task(db, { dueTime: '23:30' })).id);
    expect(late).toMatchObject({ endDate: '2026-11-10', endTime: '23:59' });
    const noTime = await taskToEvent(db, (await task(db, { dueTime: null })).id);
    expect(noTime).toMatchObject({ allDay: true, startTime: null, endTime: null });
    expect(addDays('2026-11-10', 0)).toBe(noTime.endDate);
  });

  it('una tarea sin fecha no se convierte ni se borra', async () => {
    const { db } = await openTestDb(noon('2026-11-04'));
    const t = await task(db, { dueDate: null, dueTime: null, rrule: null, reminders: [] });
    await expect(taskToEvent(db, t.id)).rejects.toBeInstanceOf(TaskToEventError);
    expect(await db.repo('tasks').list()).toHaveLength(1);
  });
});

describe('mover el inicio de un evento', () => {
  it('el fin mantiene la duración', () => {
    expect(shiftEndDate('2026-09-01', '2026-09-05', '2026-09-02')).toBe('2026-09-06');
  });

  it('una fecha vacía no rompe nada', () => {
    expect(shiftEndDate('', '2026-09-05', '2026-09-02')).toBe('2026-09-02');
    expect(shiftEndDate('2026-09-01', '', '2026-09-02')).toBe('2026-09-02');
    expect(shiftEndDate('2026-09-01', '2026-09-05', '')).toBe('');
  });

  it('una repetición semanal sigue al nuevo día', () => {
    // 2026-09-03 es jueves y 2026-09-04, viernes.
    const draft = { weekdays: [1, 4], monthDay: 1 };
    expect(followStartDate(draft, '2026-09-03', '2026-09-04').weekdays).toEqual([1, 5]);
    // Si el día de antes no estaba entre los elegidos, no se toca.
    expect(followStartDate(draft, '2026-09-02', '2026-09-04').weekdays).toEqual([1, 4]);
  });

  it('una repetición mensual sigue al nuevo día del mes', () => {
    const draft = { weekdays: [], monthDay: 3 };
    expect(followStartDate(draft, '2026-09-03', '2026-09-15').monthDay).toBe(15);
    expect(followStartDate({ ...draft, monthDay: -1 }, '2026-09-03', '2026-09-15').monthDay).toBe(
      -1,
    );
  });

  it('con una fecha vacía no cambia la repetición', () => {
    const draft = { weekdays: [4], monthDay: 3 };
    expect(followStartDate(draft, '', '2026-09-15')).toEqual(draft);
    expect(followStartDate(draft, '2026-09-03', '')).toEqual(draft);
  });
});
