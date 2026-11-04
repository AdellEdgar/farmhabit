import { describe, expect, it } from 'vitest';
import { computeGame } from '../src/game/creatures';
import { createHabit } from '../src/services/habits';
import { endVacation, scheduleVacation } from '../src/services/vacations';
import { eachDay } from '../src/util/dates';
import { makeLog, noon, openTestDb } from './helpers/fixtures';

const TODAY = '2026-10-24';
type Db = Awaited<ReturnType<typeof openTestDb>>['db'];

async function gameOf(db: Db, today = TODAY) {
  const [habits, logs, tasks, taskCompletions, purchases, vacations] = await Promise.all([
    db.repo('habits').list({ includeDeleted: true }),
    db.repo('habitLogs').list(),
    db.repo('tasks').list(),
    db.repo('taskCompletions').list(),
    db.repo('purchases').list(),
    db.repo('vacations').list(),
  ]);
  return computeGame({ habits, logs, tasks, taskCompletions, purchases, vacations, today });
}

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

  it('protegen a las criaturas los días programados', async () => {
    const { db, clock } = await openTestDb(noon('2026-09-01'));
    const h = await createHabit(db, {
      name: 'h',
      startDate: '2026-09-01',
      config: { effort: 1, schedule: { type: 'daily' }, target: null },
    });
    await scheduleVacation(db, '2026-09-10', '2026-09-12', '2026-09-01');
    clock.set(noon('2026-09-14'));
    await db.applyEntities({
      habitLogs: [...eachDay('2026-09-01', '2026-09-09')].map((d) => makeLog(h, d)),
    });
    // 9 días hechos (7 × 15 y 2 × 16 con el bonus de la primera semana); del 10 al 12
    // vacaciones (no restan) y el 13 fallado (−25).
    expect((await gameOf(db, '2026-09-14')).creatures[0]!.xp).toBe(7 * 15 + 2 * 16 - 25);
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
