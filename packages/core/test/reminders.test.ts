import { describe, expect, it } from 'vitest';
import { remindersBetween } from '../src/domain/reminders';
import { localDateTimeToEpoch } from '../src/util/dates';
import { makeHabit, makeLog, makeTask } from './helpers/fixtures';

const at = (date: string, time: string) => localDateTimeToEpoch(date, time);
const TODAY = '2026-10-24'; // sábado
const MIN = 60_000;

describe('avisos de tareas', () => {
  const task = makeTask({
    title: 'Entregar práctica',
    dueDate: TODAY,
    dueTime: '18:00',
    reminders: [{ offsetMin: 60 }, { offsetMin: 1440 }],
  });

  it('salta cada aviso una vez dentro del intervalo', () => {
    const events = remindersBetween({
      tasks: [task],
      habits: [],
      logs: [],
      from: at('2026-10-23', '00:00'),
      to: at(TODAY, '23:59'),
    });
    expect(events.map((e) => [e.at, e.kind === 'task' && e.offsetMin])).toEqual([
      [at('2026-10-23', '18:00'), 1440],
      [at(TODAY, '17:00'), 60],
    ]);
  });

  it('el intervalo excluye el inicio e incluye el final (no se repiten avisos)', () => {
    const t = at(TODAY, '17:00');
    const base = { tasks: [task], habits: [], logs: [] };
    expect(remindersBetween({ ...base, from: t - MIN, to: t })).toHaveLength(1);
    expect(remindersBetween({ ...base, from: t, to: t + MIN })).toHaveLength(0);
  });

  it('las tareas completadas o borradas no avisan', () => {
    const range = { habits: [], logs: [], from: at(TODAY, '00:00'), to: at(TODAY, '23:59') };
    expect(remindersBetween({ ...range, tasks: [{ ...task, status: 'done' }] })).toEqual([]);
    expect(remindersBetween({ ...range, tasks: [{ ...task, deletedAt: 5 }] })).toEqual([]);
  });

  it('las claves son estables para no repetir el mismo aviso', () => {
    const range = {
      tasks: [task],
      habits: [],
      logs: [],
      from: at(TODAY, '00:00'),
      to: at(TODAY, '23:59'),
    };
    expect(remindersBetween(range)[0]?.key).toBe(remindersBetween(range)[0]?.key);
  });
});

describe('avisos de hábitos', () => {
  const habit = makeHabit({
    name: 'Leer',
    startDate: '2026-10-01',
    reminders: [{ time: '21:00', days: [] }],
  });
  const day = { from: at(TODAY, '00:00'), to: at(TODAY, '23:59'), tasks: [] };

  it('recuerda el hábito si aún no está hecho', () => {
    const events = remindersBetween({ ...day, habits: [habit], logs: [] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'habit', at: at(TODAY, '21:00'), date: TODAY });
  });

  it('no recuerda lo que ya está hecho o saltado', () => {
    expect(remindersBetween({ ...day, habits: [habit], logs: [makeLog(habit, TODAY)] })).toEqual(
      [],
    );
    expect(
      remindersBetween({ ...day, habits: [habit], logs: [makeLog(habit, TODAY, 'skipped')] }),
    ).toEqual([]);
  });

  it('sí recuerda si la cantidad no llega al objetivo', () => {
    const water = makeHabit({
      startDate: '2026-10-01',
      config: { target: { quantity: 2, unit: 'L' } },
      reminders: [{ time: '20:00', days: [] }],
    });
    const logs = [makeLog(water, TODAY, 'done', 1)];
    expect(remindersBetween({ ...day, habits: [water], logs })).toHaveLength(1);
  });

  it('no avisa los días que no toca, ni de hábitos archivados', () => {
    const weekdays = makeHabit({
      startDate: '2026-10-01',
      config: { schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] } },
      reminders: [{ time: '08:00', days: [] }],
    });
    const archived = { ...habit, archivedAt: 5 };
    expect(remindersBetween({ ...day, habits: [weekdays, archived], logs: [] })).toEqual([]);
  });

  it('N veces por semana deja de avisar al cumplir el objetivo', () => {
    const gym = makeHabit({
      startDate: '2026-10-01',
      config: { schedule: { type: 'timesPerWeek', times: 2 } },
      reminders: [{ time: '19:00', days: [] }],
    });
    const oneDone = [makeLog(gym, '2026-10-20')];
    const twoDone = [...oneDone, makeLog(gym, '2026-10-22')];
    expect(remindersBetween({ ...day, habits: [gym], logs: oneDone })).toHaveLength(1);
    expect(remindersBetween({ ...day, habits: [gym], logs: twoDone })).toEqual([]);
  });

  it('un intervalo de varios días devuelve los avisos ordenados', () => {
    const events = remindersBetween({
      tasks: [makeTask({ dueDate: '2026-10-25', dueTime: '10:00', reminders: [{ offsetMin: 0 }] })],
      habits: [habit],
      logs: [],
      from: at(TODAY, '00:00'),
      to: at('2026-10-25', '23:59'),
    });
    expect(events.map((e) => e.at)).toEqual([
      at(TODAY, '21:00'),
      at('2026-10-25', '10:00'),
      at('2026-10-25', '21:00'),
    ]);
  });
});
