import { describe, expect, it } from 'vitest';
import { completionRate, dailyCompletion, habitCalendar } from '../src/domain/stats';
import { makeHabit, makeLog } from './helpers/fixtures';

const TODAY = '2026-10-24'; // sábado

describe('calendario de un hábito', () => {
  it('distingue hecho, a medias, saltado, fallado, pendiente y días que no tocan', () => {
    const water = makeHabit({
      startDate: '2026-10-19',
      config: {
        schedule: { type: 'weekdays', days: [1, 2, 3, 4, 6] },
        target: { quantity: 2, unit: 'L' },
      },
    });
    const logs = [
      makeLog(water, '2026-10-19', 'done', 2),
      makeLog(water, '2026-10-20', 'done', 1),
      makeLog(water, '2026-10-21', 'skipped'),
    ];
    const cal = habitCalendar(water, logs, '2026-10-18', '2026-10-25', TODAY);
    expect(cal.map((c) => c.status)).toEqual([
      'off', // 18: antes de empezar
      'done', // 19
      'partial', // 20
      'skipped', // 21
      'missed', // 22 jueves
      'off', // 23 viernes: no toca
      'pending', // 24 hoy
      'off', // 25 futuro
    ]);
    expect(completionRate(cal)).toBeCloseTo(1 / 3);
  });

  it('sin días que cuenten no hay porcentaje', () => {
    const h = makeHabit({ startDate: TODAY });
    expect(completionRate(habitCalendar(h, [], TODAY, TODAY, TODAY))).toBeNull();
  });
});

describe('cumplimiento diario', () => {
  it('cuenta hechos y totales de todos los hábitos', () => {
    const a = makeHabit({ startDate: '2026-10-22' });
    const b = makeHabit({ startDate: '2026-10-23' });
    const logs = [makeLog(a, '2026-10-22'), makeLog(a, '2026-10-23'), makeLog(b, '2026-10-24')];
    expect(dailyCompletion([a, b], logs, '2026-10-22', TODAY, TODAY)).toEqual([
      { date: '2026-10-22', done: 1, total: 1 },
      { date: '2026-10-23', done: 1, total: 2 },
      { date: '2026-10-24', done: 1, total: 2 },
    ]);
  });
});
