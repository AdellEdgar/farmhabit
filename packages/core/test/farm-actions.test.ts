import { describe, expect, it } from 'vitest';
import { computeAchievements } from '../src/game/achievements';
import { computeFarm } from '../src/game/engine';
import {
  buyAnimal,
  endVacation,
  FarmActionError,
  scheduleVacation,
  shopOffers,
} from '../src/services/farm';
import { createHabit, setHabitLog } from '../src/services/habits';
import { eachDay } from '../src/util/dates';
import { makeAnimal, makeHabit, makeLog, noon, openTestDb } from './helpers/fixtures';

const TODAY = '2026-10-24';

async function farmOf(db: Awaited<ReturnType<typeof openTestDb>>['db'], today = TODAY) {
  const [habits, logs, animals, vacations] = await Promise.all([
    db.repo('habits').list({ includeDeleted: true }),
    db.repo('habitLogs').list(),
    db.repo('animals').list(),
    db.repo('vacations').list(),
  ]);
  return computeFarm({ habits, logs, animals, vacations, today });
}

describe('tienda', () => {
  it('ofrece las especies con su nivel y precio', () => {
    const farm = computeFarm({ habits: [], logs: [], animals: [], vacations: [], today: TODAY });
    const offers = shopOffers(farm);
    expect(offers.find((o) => o.species === 'chicken')).toMatchObject({
      unlocked: true,
      price: 50,
    });
    expect(offers.find((o) => o.species === 'cow')).toMatchObject({
      unlocked: false,
      unlockLevel: 7,
    });
  });

  it('comprar descuenta el grano y añade el animal con su nombre', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const h = makeHabit({ startDate: '2026-10-20', config: { effort: 5 } });
    await db.applyEntities({
      habits: [h],
      habitLogs: [...eachDay('2026-10-20', '2026-10-23')].map((d) => makeLog(h, d)),
    });
    const before = await farmOf(db);
    expect(before.grain).toBe(200);
    await buyAnimal(db, before, 'chicken', 'Clueca');
    const after = await farmOf(db);
    expect(after.grain).toBe(150);
    expect(after.animals.map((a) => a.name)).toEqual(['Clueca']);
  });

  it('no deja comprar sin grano, sin nivel, sin nombre o sin sitio', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const poor = await farmOf(db);
    await expect(buyAnimal(db, poor, 'chicken', 'Pío')).rejects.toThrow(/grano/);
    const rich = { ...poor, grain: 10_000 };
    await expect(buyAnimal(db, rich, 'horse', 'Rayo')).rejects.toThrow(/nivel 10/);
    await expect(buyAnimal(db, rich, 'chicken', '   ')).rejects.toBeInstanceOf(FarmActionError);
    const full = {
      ...rich,
      animals: Array.from({ length: 6 }, (_, i) => ({
        id: `a${i}`,
        name: 'x',
        species: 'chicken' as const,
        acquiredOn: TODAY,
        source: 'bought' as const,
        diedOn: null,
      })),
    };
    await expect(buyAnimal(db, full, 'chicken', 'Pío')).rejects.toThrow(/llena/);
  });
});

describe('vacaciones', () => {
  it('solo se pueden programar desde mañana y sin solaparse', async () => {
    const { db } = await openTestDb(noon(TODAY));
    await expect(scheduleVacation(db, TODAY, '2026-10-30', TODAY)).rejects.toThrow(/antelación/);
    await scheduleVacation(db, '2026-10-25', '2026-10-30', TODAY);
    await expect(scheduleVacation(db, '2026-10-28', '2026-11-02', TODAY)).rejects.toThrow(
      /esas fechas/,
    );
    await expect(scheduleVacation(db, '2026-11-01', '2026-12-31', TODAY)).rejects.toThrow(
      /30 días/,
    );
  });

  it('protegen la granja los días programados', async () => {
    const { db, clock } = await openTestDb(noon('2026-09-01'));
    await createHabit(db, {
      name: 'h',
      startDate: '2026-09-01',
      config: { effort: 1, schedule: { type: 'daily' }, target: null },
    });
    await scheduleVacation(db, '2026-09-10', '2026-09-12', '2026-09-01');
    clock.set(noon('2026-09-14'));
    const farm = await farmOf(db, '2026-09-14');
    expect(farm.days.filter((d) => d.vacation).map((d) => d.date)).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ]);
  });

  it('terminarlas antes de tiempo no quita la protección de los días ya pasados', async () => {
    const { db } = await openTestDb(noon('2026-09-01'));
    const v = await scheduleVacation(db, '2026-09-10', '2026-09-20', '2026-09-01');
    await endVacation(db, v.id, '2026-09-14');
    expect(await db.repo('vacations').get(v.id)).toMatchObject({
      startDate: '2026-09-10',
      endDate: '2026-09-13',
    });
  });

  it('cancelar unas vacaciones que aún no han empezado las borra', async () => {
    const { db } = await openTestDb(noon('2026-09-01'));
    const v = await scheduleVacation(db, '2026-09-10', '2026-09-12', '2026-09-01');
    await endVacation(db, v.id, '2026-09-05');
    expect(await db.repo('vacations').list()).toEqual([]);
  });
});

describe('logros', () => {
  it('se calculan desde los datos', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const h = await createHabit(db, {
      name: 'Leer',
      startDate: TODAY,
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
    });
    await setHabitLog(db, h.id, TODAY, { status: 'done' }, TODAY);
    const farm = computeFarm({
      habits: [h],
      logs: await db.repo('habitLogs').list(),
      animals: [makeAnimal({ acquiredOn: TODAY })],
      vacations: [],
      today: TODAY,
    });
    const list = computeAchievements({
      farm,
      habits: [h],
      logs: await db.repo('habitLogs').list(),
      tasks: [],
      taskCompletions: [],
    });
    expect(list.find((a) => a.id === 'primer-paso')?.unlocked).toBe(true);
    expect(list.find((a) => a.id === 'constancia')).toMatchObject({
      unlocked: false,
      progress: 1 / 7,
    });
    expect(list.find((a) => a.id === 'granja-viva')?.progress).toBeCloseTo(1 / 5);
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
  });
});
