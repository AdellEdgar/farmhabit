import { describe, expect, it } from 'vitest';
import {
  configOn,
  habitReminderInstants,
  habitsDueOn,
  habitStreak,
  isActiveOn,
  isScheduledOn,
  logRatio,
  withConfigChange,
} from '../src/domain/habits';
import {
  changeCreatureSpecies,
  changeHabitConfig,
  ClosedDayError,
  createHabit,
  habitLogId,
  moveHabit,
  setHabitArchived,
  setHabitLog,
} from '../src/services/habits';
import { computeGame } from '../src/game/creatures';
import { compareSortKey } from '../src/util/fractional-index';
import { addDays, localDateTimeToEpoch } from '../src/util/dates';
import { makeHabit, makeLog, noon, openTestDb } from './helpers/fixtures';

const TODAY = '2026-10-24'; // sábado

describe('frecuencias', () => {
  it('diario, días concretos y cada N días', () => {
    expect(isScheduledOn({ type: 'daily' }, '2026-10-01', TODAY)).toBe(true);
    expect(isScheduledOn({ type: 'weekdays', days: [1, 3, 5] }, '2026-10-01', TODAY)).toBe(false);
    expect(isScheduledOn({ type: 'weekdays', days: [6] }, '2026-10-01', TODAY)).toBe(true);
    expect(isScheduledOn({ type: 'everyNDays', interval: 3 }, '2026-10-18', TODAY)).toBe(true);
    expect(isScheduledOn({ type: 'everyNDays', interval: 3 }, '2026-10-19', TODAY)).toBe(false);
  });

  it('hábitos que tocan hoy, en orden manual y sin archivados', () => {
    const a = makeHabit({ name: 'a', sortKey: 'b' });
    const b = makeHabit({ name: 'b', sortKey: 'a' });
    const lmv = makeHabit({
      name: 'lmv',
      config: { schedule: { type: 'weekdays', days: [1, 3, 5] } },
    });
    const archived = makeHabit({ name: 'arch', archivedAt: noon('2026-10-01') });
    const future = makeHabit({ name: 'futuro', startDate: '2026-11-01' });
    expect(habitsDueOn([a, b, lmv, archived, future], TODAY).map((h) => h.name)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('cantidades', () => {
  const habit = makeHabit({ config: { target: { quantity: 2, unit: 'L' } } });
  const cfg = habit.configHistory[0]!;

  it('da cumplimiento parcial según la cantidad', () => {
    expect(logRatio(makeLog(habit, TODAY, 'done', 1.5), cfg)).toBe(0.75);
    expect(logRatio(makeLog(habit, TODAY, 'done', 3), cfg)).toBe(1);
    expect(logRatio(makeLog(habit, TODAY, 'skipped'), cfg)).toBeNull();
    expect(logRatio(undefined, cfg)).toBe(0);
  });
});

describe('rachas', () => {
  const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

  it('cuenta días seguidos; hoy sin hacer no rompe la racha', () => {
    const h = makeHabit({ startDate: '2026-10-15' });
    const logs = days('2026-10-18', 6).map((d) => makeLog(h, d)); // 18..23
    expect(habitStreak(h, logs, TODAY)).toEqual({ current: 6, best: 6, unit: 'days' });
  });

  it('un día sin hacer rompe la racha pero se recuerda la mejor', () => {
    const h = makeHabit({ startDate: '2026-10-10' });
    const logs = [...days('2026-10-10', 5), ...days('2026-10-21', 4)].map((d) => makeLog(h, d));
    expect(habitStreak(h, logs, TODAY)).toEqual({ current: 4, best: 5, unit: 'days' });
  });

  it('saltado no suma ni rompe', () => {
    const h = makeHabit({ startDate: '2026-10-20' });
    const logs = [
      makeLog(h, '2026-10-20'),
      makeLog(h, '2026-10-21', 'skipped'),
      makeLog(h, '2026-10-22'),
      makeLog(h, '2026-10-23'),
    ];
    expect(habitStreak(h, logs, TODAY).current).toBe(3);
  });

  it('los días que no tocan no rompen la racha', () => {
    const h = makeHabit({
      startDate: '2026-10-05',
      config: { schedule: { type: 'weekdays', days: [1, 3, 5] } },
    });
    const logs = [
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
      '2026-10-14',
      '2026-10-16',
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
    ].map((d) => makeLog(h, d));
    expect(habitStreak(h, logs, TODAY).current).toBe(9);
  });

  it('un hábito creado hoy empieza con racha 0', () => {
    const h = makeHabit({ startDate: TODAY });
    expect(habitStreak(h, [], TODAY)).toEqual({ current: 0, best: 0, unit: 'days' });
  });

  it('los registros anteriores al inicio no cuentan', () => {
    const h = makeHabit({ startDate: '2026-10-23' });
    const logs = [makeLog(h, '2026-10-20'), makeLog(h, '2026-10-23')];
    expect(habitStreak(h, logs, TODAY).current).toBe(1);
  });

  it('cantidad sin llegar al objetivo no cuenta como hecho', () => {
    const h = makeHabit({
      startDate: '2026-10-22',
      config: { target: { quantity: 2, unit: 'L' } },
    });
    const logs = [makeLog(h, '2026-10-22', 'done', 2), makeLog(h, '2026-10-23', 'done', 1)];
    expect(habitStreak(h, logs, TODAY).current).toBe(0);
  });

  it('N veces por semana cuenta semanas cumplidas', () => {
    const h = makeHabit({
      startDate: '2026-10-05',
      config: { schedule: { type: 'timesPerWeek', times: 2 } },
    });
    const logs = ['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-17', '2026-10-21'].map((d) =>
      makeLog(h, d),
    );
    // Semanas del 5 y del 12 cumplidas; la del 19 va por 1 de 2 (en curso, no rompe).
    expect(habitStreak(h, logs, TODAY)).toEqual({ current: 2, best: 2, unit: 'weeks' });
  });
});

describe('configuración con historial', () => {
  it('un cambio se aplica desde mañana y no reescribe el pasado', () => {
    const h = makeHabit({ startDate: '2026-10-01', config: { effort: 2 } });
    const history = withConfigChange(
      h,
      { effort: 5, schedule: { type: 'daily' }, target: null },
      TODAY,
    );
    const changed = { ...h, configHistory: history };
    expect(configOn(changed, TODAY)?.effort).toBe(2);
    expect(configOn(changed, '2026-10-25')?.effort).toBe(5);
  });

  it('si el hábito empieza hoy, el cambio reemplaza la configuración', () => {
    const h = makeHabit({ startDate: TODAY, config: { effort: 2 } });
    const history = withConfigChange(
      h,
      { effort: 4, schedule: { type: 'daily' }, target: null },
      TODAY,
    );
    expect(history).toEqual([
      { since: TODAY, effort: 4, schedule: { type: 'daily' }, target: null },
    ]);
  });
});

describe('recordatorios de hábitos', () => {
  it('solo los días que toca y en los días elegidos', () => {
    const h = makeHabit({
      config: { schedule: { type: 'weekdays', days: [6, 7] } },
      reminders: [
        { time: '21:00', days: [] },
        { time: '10:00', days: [7] },
      ],
    });
    expect(habitReminderInstants(h, TODAY)).toEqual([localDateTimeToEpoch(TODAY, '21:00')]);
    expect(habitReminderInstants(h, '2026-10-25')).toEqual([
      localDateTimeToEpoch('2026-10-25', '10:00'),
      localDateTimeToEpoch('2026-10-25', '21:00'),
    ]);
    expect(habitReminderInstants(h, '2026-10-26')).toEqual([]);
  });
});

describe('servicio de hábitos', () => {
  it('registra con id determinista, permite cambiar y desmarcar', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const h = await createHabit(db, {
      name: 'Agua',
      startDate: '2026-10-01',
      config: { effort: 2, schedule: { type: 'daily' }, target: { quantity: 2, unit: 'L' } },
    });
    const log = await setHabitLog(db, h.id, TODAY, { status: 'done', value: 1.5 }, TODAY);
    expect(log?.id).toBe(habitLogId(h.id, TODAY));
    expect(log?.value).toBe(1.5);

    await setHabitLog(db, h.id, TODAY, { status: 'done', value: 2 }, TODAY);
    expect((await db.repo('habitLogs').list()).map((l) => l.value)).toEqual([2]);

    await setHabitLog(db, h.id, TODAY, { status: 'none' }, TODAY);
    expect(await db.repo('habitLogs').list()).toHaveLength(0);

    // Volver a marcar resucita el mismo registro.
    await setHabitLog(db, h.id, TODAY, { status: 'skipped' }, TODAY);
    expect((await db.repo('habitLogs').list()).map((l) => l.status)).toEqual(['skipped']);
  });

  it('solo se puede registrar hoy y ayer', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const h = await createHabit(db, {
      name: 'Leer',
      startDate: '2026-10-01',
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
    });
    await expect(
      setHabitLog(db, h.id, '2026-10-23', { status: 'done' }, TODAY),
    ).resolves.toBeTruthy();
    await expect(
      setHabitLog(db, h.id, '2026-10-22', { status: 'done' }, TODAY),
    ).rejects.toBeInstanceOf(ClosedDayError);
    await expect(
      setHabitLog(db, h.id, '2026-10-25', { status: 'done' }, TODAY),
    ).rejects.toBeInstanceOf(ClosedDayError);
  });

  it('crea al final de la lista y reordena tocando solo un hábito', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const config = { effort: 3, schedule: { type: 'daily' as const }, target: null };
    const a = await createHabit(db, { name: 'a', startDate: TODAY, config });
    const b = await createHabit(db, { name: 'b', startDate: TODAY, config });
    const c = await createHabit(db, { name: 'c', startDate: TODAY, config });
    const order = async () =>
      (await db.repo('habits').list()).sort(compareSortKey).map((h) => h.name);
    expect(await order()).toEqual(['a', 'b', 'c']);

    await moveHabit(db, c.id, null, a.id);
    expect(await order()).toEqual(['c', 'a', 'b']);
    await moveHabit(db, c.id, a.id, b.id);
    expect(await order()).toEqual(['a', 'c', 'b']);
  });

  it('cambiar el esfuerzo guarda el historial', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const h = await createHabit(db, {
      name: 'Gym',
      startDate: '2026-10-01',
      config: { effort: 4, schedule: { type: 'daily' }, target: null },
    });
    const changed = await changeHabitConfig(
      db,
      h.id,
      { effort: 5, schedule: { type: 'daily' }, target: null },
      TODAY,
    );
    expect(changed.configHistory.map((c) => [c.since, c.effort])).toEqual([
      ['2026-10-01', 4],
      ['2026-10-25', 5],
    ]);
  });
});

describe('criatura del hábito', () => {
  it('createHabit guarda la especie y el nombre de la criatura', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const h = await createHabit(db, {
      name: 'Leer',
      startDate: TODAY,
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
      creatureSpecies: 'tortuga',
      creatureName: 'Tortuguita',
    });
    expect(await db.repo('habits').get(h.id)).toMatchObject({
      creatureSpecies: 'tortuga',
      creatureName: 'Tortuguita',
    });
  });
});

describe('archivar y reactivar', () => {
  it('reactivar guarda la pausa y los días archivados no cuentan como fallos', async () => {
    const { db, clock } = await openTestDb(noon('2026-09-01'));
    const h = await createHabit(db, {
      name: 'Leer',
      startDate: '2026-09-01',
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
    });
    for (const d of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      clock.set(noon(d));
      await setHabitLog(db, h.id, d, { status: 'done' }, d);
    }
    clock.set(noon('2026-09-04'));
    await setHabitArchived(db, h.id, true, '2026-09-04');
    clock.set(noon('2026-09-10'));
    const back = await setHabitArchived(db, h.id, false, '2026-09-10');
    expect(back.archivedAt).toBeNull();
    expect(back.configHistory.at(-1)).toMatchObject({
      since: '2026-09-10',
      pausedSince: '2026-09-04',
    });
    expect(isActiveOn(back, '2026-09-06')).toBe(false);
    expect(isActiveOn(back, '2026-09-10')).toBe(true);

    const [logs] = await Promise.all([db.repo('habitLogs').list()]);
    const game = computeGame({
      habits: [back],
      logs,
      tasks: [],
      taskCompletions: [],
      purchases: [],
      vacations: [],
      today: '2026-09-11',
    });
    // 3 días hechos (+25) y solo el 10 fallado (−15): del 4 al 9 estaba archivado.
    expect(game.creatures[0]!.xp).toBe(3 * 25 - 15);
  });
});

describe('cambiar la especie de una criatura', () => {
  const habit = async () => {
    const { db } = await openTestDb();
    const h = await createHabit(db, {
      name: 'Leer',
      description: '',
      icon: '',
      color: '',
      startDate: '2026-10-01',
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
      creatureSpecies: 'medusa',
    });
    return { db, h };
  };

  it('guarda la anterior con la etapa alcanzada', async () => {
    const { db, h } = await habit();
    const next = await changeCreatureSpecies(db, h.id, 'tortuga', 2);
    expect(next.creatureSpecies).toBe('tortuga');
    expect(next.creaturePast).toEqual([{ species: 'medusa', maxStage: 2 }]);
  });

  it('volver a una especie conserva la mayor etapa', async () => {
    const { db, h } = await habit();
    await changeCreatureSpecies(db, h.id, 'tortuga', 3);
    await changeCreatureSpecies(db, h.id, 'medusa', 3);
    const again = await changeCreatureSpecies(db, h.id, 'tortuga', 1);
    expect(again.creaturePast).toEqual(
      expect.arrayContaining([
        { species: 'medusa', maxStage: 3 },
        { species: 'tortuga', maxStage: 3 },
      ]),
    );
    expect(again.creaturePast).toHaveLength(2);
  });

  it('elegir la misma no cambia nada', async () => {
    const { db, h } = await habit();
    const same = await changeCreatureSpecies(db, h.id, 'medusa', 2);
    expect(same.updatedAt).toBe(h.updatedAt);
    expect(same.creaturePast).toEqual([]);
  });

  it('un huevo no deja rastro en la colección', async () => {
    const { db, h } = await habit();
    const next = await changeCreatureSpecies(db, h.id, 'tortuga', 0);
    expect(next.creaturePast).toEqual([]);
  });
});
