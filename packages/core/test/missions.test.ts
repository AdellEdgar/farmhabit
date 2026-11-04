import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATURE_RULES as RULES } from '../src/game/creature-rules';
import { computeGame, type GameInput } from '../src/game/creatures';
import { selectMissions } from '../src/game/missions';
import { summaryToShow } from '../src/game/week-summary';
import type { Habit } from '../src/model/types';
import { addDays, eachDay } from '../src/util/dates';
import { makeHabit, makeLog, makeTask, noon } from './helpers/fixtures';

const WEEK = '2026-11-02'; // lunes, primera semana con misiones
const OLD = '2026-10-01';

const select = (habits: Habit[], prevTasksDone = 0, prevXp = 0, week = WEEK) =>
  selectMissions({ week, habits, prevTasksDone, prevXp, rules: RULES });

const game = (input: Partial<GameInput> & { today: string }) =>
  computeGame({
    habits: [],
    logs: [],
    tasks: [],
    taskCompletions: [],
    purchases: [],
    vacations: [],
    ...input,
  });

/** Una semana (desde `WEEK`) en la que toca una misión de este tipo. */
function weekWith(kind: 'perfect' | 'xp'): string {
  const h = makeHabit({ startDate: OLD });
  for (let w = WEEK; ; w = addDays(w, 7)) {
    if (select([h], 0, 0, w).some((m) => m.kind === kind)) return w;
  }
}

describe('elegir las misiones de la semana', () => {
  it('no depende del orden de los hábitos', () => {
    const habits = ['a', 'b', 'c', 'd'].map((n) => makeHabit({ name: n, startDate: OLD }));
    expect(select([...habits].reverse())).toEqual(select(habits));
  });

  it('con hábitos: una del hábito, una de tareas y otra de días perfectos o XP', () => {
    const kinds = select([makeHabit({ startDate: OLD })]).map((m) => m.kind);
    expect(kinds).toHaveLength(3);
    expect(kinds.slice(0, 2)).toEqual(['habit', 'tasks']);
    expect(['perfect', 'xp']).toContain(kinds[2]);
  });

  it('sin hábitos: tres de tareas con 5, 10 y 15', () => {
    const list = select([]);
    expect(list.map((m) => [m.kind, m.target, m.reward])).toEqual([
      ['tasks', 5, 40],
      ['tasks', 10, 40],
      ['tasks', 15, 40],
    ]);
    expect(new Set(list.map((m) => m.id)).size).toBe(3);
  });

  it('las tareas van de 5 a 10 según la semana anterior', () => {
    const h = makeHabit({ startDate: OLD });
    const tasks = (n: number) => select([h], n).find((m) => m.kind === 'tasks')?.target;
    expect(tasks(0)).toBe(5);
    expect(tasks(7)).toBe(7);
    expect(tasks(30)).toBe(10);
  });

  it('la XP pide el 90 % de la semana anterior, 100 como mínimo: repetir la semana basta', () => {
    const h = makeHabit({ startDate: OLD });
    const w = weekWith('xp');
    const xp = (n: number) => select([h], 0, n, w).find((m) => m.kind === 'xp')?.target;
    expect(xp(50)).toBe(100);
    expect(xp(1000)).toBe(900);
  });

  it('el objetivo de un hábito es lo programado esa semana', () => {
    const target = (schedule: Habit['configHistory'][number]['schedule']) =>
      select([makeHabit({ startDate: OLD, config: { schedule } })])[0];
    expect(target({ type: 'daily' })).toMatchObject({ kind: 'habit', target: 7, reward: 30 });
    expect(target({ type: 'weekdays', days: [1, 3, 5] })?.target).toBe(3);
    expect(target({ type: 'timesPerWeek', times: 4 })?.target).toBe(4);
    expect(target({ type: 'timesPerMonth', times: 9 })?.target).toBe(3);
  });

  it('no valen los que empiezan ese lunes ni los archivados', () => {
    const late = makeHabit({ startDate: WEEK });
    const archived = makeHabit({ startDate: OLD, archivedAt: noon('2026-10-20') });
    for (const h of [late, archived])
      expect(select([h]).map((m) => m.kind)).toEqual(['tasks', 'tasks', 'tasks']);
  });
});

describe('progreso y premio', () => {
  const weekly = () =>
    makeHabit({ startDate: OLD, config: { schedule: { type: 'timesPerWeek', times: 3 } } });
  /** Pesetas que aporta la misión del hábito: compara con un premio de 0. */
  const reward = (input: Partial<GameInput> & { today: string }) =>
    game(input).pesetas -
    game({
      ...input,
      rules: { ...RULES, missionRewards: { ...RULES.missionRewards, habit: 0 } },
    }).pesetas;

  it('cumplir un hábito de objetivo 3 se apunta ese día y paga una sola vez', () => {
    const h = weekly();
    const logs = ['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => makeLog(h, d));
    const s = game({ habits: [h], logs, today: '2026-11-06' });
    expect(s.missions.find((m) => m.kind === 'habit')).toMatchObject({
      habitId: h.id,
      target: 3,
      progress: 3,
      doneOn: '2026-11-04',
    });
    expect(reward({ habits: [h], logs, today: '2026-11-06' })).toBe(30);
    expect(s.weeks[WEEK]?.missionsDone).toBeGreaterThanOrEqual(1);
  });

  it('el progreso no pasa del objetivo', () => {
    const h = weekly();
    const logs = [...eachDay('2026-11-02', '2026-11-06')].map((d) => makeLog(h, d));
    const s = game({ habits: [h], logs, today: '2026-11-06' });
    expect(s.missions.find((m) => m.kind === 'habit')?.progress).toBe(3);
  });

  it('deshacer hoy lo que la cumplía quita el premio', () => {
    const h = weekly();
    const days = ['2026-11-02', '2026-11-03', '2026-11-04'];
    const logs = days.map((d) => makeLog(h, d));
    expect(reward({ habits: [h], logs, today: '2026-11-04' })).toBe(30);
    const undone = logs.slice(0, 2);
    const s = game({ habits: [h], logs: undone, today: '2026-11-04' });
    expect(s.missions.find((m) => m.kind === 'habit')).toMatchObject({ progress: 2, doneOn: null });
    expect(reward({ habits: [h], logs: undone, today: '2026-11-04' })).toBe(0);
  });

  it('el historial anterior a la fecha de inicio no da premios ni misiones', () => {
    const h = weekly();
    const logs = [...eachDay(OLD, '2026-11-01')].map((d) => makeLog(h, d));
    const before = game({ habits: [h], logs, today: '2026-11-01' });
    expect(before.missions).toEqual([]);
    expect(Object.values(before.weeks).every((w) => w.missionsDone === 0)).toBe(true);
    const free = game({
      habits: [h],
      logs,
      today: '2026-11-01',
      rules: { ...RULES, missionRewards: { habit: 0, tasks: 0, perfect: 0, xp: 0 } },
    });
    expect(before.pesetas).toBe(free.pesetas);
  });

  it('sin ningún dato también hay misiones de tareas', () => {
    expect(game({ today: '2026-11-04' }).missions.map((m) => m.kind)).toEqual([
      'tasks',
      'tasks',
      'tasks',
    ]);
  });

  it('las tareas cuentan las completadas esta semana, no las anteriores', () => {
    const task = (d: string) =>
      makeTask({ createdAt: noon(OLD), status: 'done', completedAt: noon(d) });
    const tasks = [task('2026-11-01'), task('2026-11-02'), task('2026-11-03')];
    const s = game({ tasks, today: '2026-11-04' });
    expect(s.missions[0]).toMatchObject({ kind: 'tasks', progress: 2 });
    expect(s.weeks[WEEK]?.tasksDone).toBe(2);
  });

  it.each([
    ['archivar', { archivedAt: noon('2026-11-04') }],
    ['borrar', { deletedAt: noon('2026-11-04') }],
  ])('%s un hábito a mitad de semana no cambia las misiones', (_, change) => {
    const a = makeHabit({ startDate: OLD });
    const b = makeHabit({ startDate: OLD });
    const logs = [a, b].flatMap((h) => [makeLog(h, '2026-11-02'), makeLog(h, '2026-11-03')]);
    const shape = (s: ReturnType<typeof game>) =>
      s.missions.map((m) => [m.id, m.habitId, m.target, m.reward]);
    const live = game({ habits: [a, b], logs, today: '2026-11-05' });
    const target = live.missions[0]!.habitId === a.id ? a : b;
    const other = target === a ? b : a;
    const changed = game({
      habits: [{ ...target, ...change }, other],
      logs,
      today: '2026-11-05',
    });
    expect(shape(changed)).toEqual(shape(live));
    expect(changed.missions[0]?.progress).toBe(2);
  });

  it('cambiar la frecuencia a mitad de semana no cambia el objetivo', () => {
    const h = makeHabit({ startDate: OLD });
    const changed: Habit = {
      ...h,
      configHistory: [
        ...h.configHistory,
        {
          since: '2026-11-05',
          effort: 3,
          schedule: { type: 'timesPerWeek', times: 2 },
          target: null,
        },
      ],
    };
    const s = game({ habits: [changed], today: '2026-11-06' });
    expect(s.missions[0]?.target).toBe(7);
  });
});

describe('días perfectos', () => {
  const a = makeHabit({ startDate: OLD });
  const b = makeHabit({ startDate: OLD });
  const perfect = (logs: ReturnType<typeof makeLog>[], habits = [a, b]) =>
    game({ habits, logs, today: '2026-11-08' }).weeks[WEEK]?.perfectDays;

  it('todo lo programado hecho', () => {
    expect(perfect([makeLog(a, '2026-11-02'), makeLog(b, '2026-11-02')])).toBe(1);
    expect(perfect([makeLog(a, '2026-11-02')])).toBe(0);
  });

  it('un saltado no lo estropea si el resto está hecho', () => {
    const logs = [makeLog(a, '2026-11-02'), makeLog(b, '2026-11-02', 'skipped')];
    expect(perfect(logs)).toBe(1);
  });

  it('un día sin nada programado no cuenta', () => {
    const monday = makeHabit({
      startDate: OLD,
      config: { schedule: { type: 'weekdays', days: [1] } },
    });
    expect(perfect([makeLog(monday, '2026-11-02')], [monday])).toBe(1);
  });

  it('solo saltados no es un día perfecto', () => {
    const logs = [makeLog(a, '2026-11-02', 'skipped')];
    expect(perfect(logs, [a])).toBe(0);
  });
});

describe('estadísticas de cada semana', () => {
  it('suma lo que ocurrió en una semana conocida', () => {
    const fuerte = makeHabit({ startDate: WEEK, config: { effort: 5 } });
    const flojo = makeHabit({ startDate: WEEK, config: { effort: 1 } });
    const logs = [
      makeLog(fuerte, '2026-11-02'),
      makeLog(fuerte, '2026-11-03'),
      makeLog(flojo, '2026-11-02'),
    ];
    const tasks = [
      makeTask({ createdAt: noon(OLD), status: 'done', completedAt: noon('2026-11-03') }),
    ];
    const w = game({ habits: [fuerte, flojo], logs, tasks, today: '2026-11-09' }).weeks[WEEK];
    expect(w).toMatchObject({
      week: WEEK,
      xp: 35 + 35 + 15,
      scheduled: 14,
      done: 3,
      tasksDone: 1,
      bestStreak: 2,
      hatched: 1,
      evolved: 0,
      topHabitId: fuerte.id,
      perfectDays: 1,
    });
    expect(w!.pesetas).toBeGreaterThanOrEqual(5 + 5 + 1 + 2);
  });

  it('una semana sin datos no existe', () => {
    const first = makeHabit({
      startDate: '2026-09-07',
      archivedAt: noon('2026-09-08'),
    });
    const later = makeHabit({ startDate: '2026-10-05' });
    const s = game({ habits: [first, later], today: '2026-10-06' });
    expect(s.weeks['2026-09-14']).toBeUndefined();
    expect(s.weeks['2026-10-05']).toBeDefined();
  });

  it('los días de vacaciones sin hacer no cuentan como programados', () => {
    const h = makeHabit({ startDate: WEEK });
    const vacations = [
      {
        id: 'v',
        createdAt: noon(OLD),
        updatedAt: noon(OLD),
        deletedAt: null,
        startDate: '2026-11-03',
        endDate: '2026-11-08',
      },
    ];
    const s = game({ habits: [h], vacations, today: '2026-11-09' });
    expect(s.weeks[WEEK]?.scheduled).toBe(1);
  });
});

describe('qué resumen semanal enseñar', () => {
  const h = makeHabit({ startDate: OLD });
  const logs = [makeLog(h, '2026-11-03')];
  const monday = game({ habits: [h], logs, today: '2026-11-09' });

  it('el primer arranque no enseña nada', () => {
    expect(summaryToShow(monday, null)).toBeNull();
  });

  it('un lunes con la semana anterior activa la devuelve', () => {
    expect(summaryToShow(monday, '2026-10-26')).toBe(WEEK);
  });

  it('también si se abre a mitad de semana', () => {
    const friday = game({ habits: [h], logs, today: '2026-11-13' });
    expect(summaryToShow(friday, '2026-10-26')).toBe(WEEK);
  });

  it('ya vista no se repite', () => {
    expect(summaryToShow(monday, WEEK)).toBeNull();
  });

  it('una semana sin actividad no se enseña', () => {
    const idle = game({ habits: [h], today: '2026-11-09' });
    expect(summaryToShow(idle, '2026-10-26')).toBeNull();
  });
});
