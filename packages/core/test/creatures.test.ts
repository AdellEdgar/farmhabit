import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CREATURE_RULES,
  nextStage,
  trainerLevel,
  unlockedSpecies,
} from '../src/game/creature-rules';
import { computeGame, habitXpGain, type GameInput, type GameState } from '../src/game/creatures';
import { defaultSpecies, SPECIES, speciesById, suggestSpecies } from '../src/game/species';
import type { Habit, HabitLog, Purchase, TaskCompletion } from '../src/model/types';
import { deterministicId, newId } from '../src/util/ids';
import { eachDay } from '../src/util/dates';
import { makeHabit, makeLog, makeTask, makeVacation, noon } from './helpers/fixtures';

describe('catálogo y reglas', () => {
  it('hay 16 especies con ids únicos', () => {
    expect(SPECIES).toHaveLength(16);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(16);
    expect(speciesById('panda')?.name).toBe('Panda luchador');
    expect(speciesById('pikachu')).toBeUndefined();
  });

  it('6 especies de inicio y 2 más por nivel hasta el 6', () => {
    expect(SPECIES.filter((s) => s.unlockLevel === 1)).toHaveLength(6);
    for (let level = 2; level <= 6; level++)
      expect(SPECIES.filter((s) => s.unlockLevel === level)).toHaveLength(2);
    expect(unlockedSpecies(1)).toHaveLength(6);
    expect(unlockedSpecies(3)).toHaveLength(10);
    expect(unlockedSpecies(6)).toHaveLength(16);
    expect(unlockedSpecies(20)).toHaveLength(16);
  });

  it('sube de etapa al alcanzar el umbral', () => {
    expect(DEFAULT_CREATURE_RULES.stageXp).toEqual([0, 50, 500, 1500, 4000]);
    expect(nextStage(49, 0)).toBe(0);
    expect(nextStage(50, 0)).toBe(1);
    expect(nextStage(4000, 1)).toBe(4);
  });

  it('solo retrocede por debajo del 80 % del umbral de su etapa', () => {
    expect(nextStage(401, 2)).toBe(2);
    expect(nextStage(400, 2)).toBe(2);
    expect(nextStage(399, 2)).toBe(1);
    expect(nextStage(10, 3)).toBe(0);
  });

  it('nivel de entrenador con la curva 100·n·(n−1)', () => {
    expect(trainerLevel(0)).toBe(1);
    expect(trainerLevel(199)).toBe(1);
    expect(trainerLevel(200)).toBe(2);
    expect(trainerLevel(600)).toBe(3);
  });

  it('sugiere una especie según el nombre del hábito, sin tildes ni mayúsculas', () => {
    expect(suggestSpecies('Leer 20 páginas', unlockedSpecies(1))).toBe('tortuga');
    expect(suggestSpecies('BEBER AGUA', unlockedSpecies(6))).toBe('poseidon');
    // Poseidón no está desbloqueado aún: cae en una de nivel 1.
    const fallback = suggestSpecies('Beber agua', unlockedSpecies(1));
    expect(unlockedSpecies(1)).toContain(fallback);
  });

  it('la especie por defecto es estable y de nivel 1', () => {
    for (const id of ['a', 'b', 'c', 'habito-123', 'zzz']) {
      expect(defaultSpecies(id)).toBe(defaultSpecies(id));
      expect(speciesById(defaultSpecies(id))?.unlockLevel).toBe(1);
    }
  });
});

// ---------- Motor ----------

const START = '2026-09-01'; // martes
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
const logsFor = (habit: Habit, from: string, to: string): HabitLog[] =>
  [...eachDay(from, to)].map((d) => makeLog(habit, d));
const creatureOf = (s: GameState, habit: Habit) => {
  const c = s.creatures.find((x) => x.habitId === habit.id);
  if (!c) throw new Error('sin criatura');
  return c;
};

describe('motor de criaturas: XP', () => {
  it('hacer un hábito de esfuerzo 3 da 25 XP', () => {
    const h = makeHabit({ startDate: START });
    const s = game({ habits: [h], logs: [makeLog(h, START)], today: '2026-09-02' });
    expect(creatureOf(s, h).xp).toBe(25);
  });

  it('fallar resta 5 × (6 − esfuerzo): fallar lo fácil castiga más', () => {
    const easy = makeHabit({ startDate: START, config: { effort: 2 } });
    const hard = makeHabit({ startDate: START, config: { effort: 5 } });
    // Día 1 hechos los dos; día 2 fallados los dos.
    const s = game({
      habits: [easy, hard],
      logs: [makeLog(easy, START), makeLog(hard, START)],
      today: '2026-09-03',
    });
    expect(creatureOf(s, easy).xp).toBe(20 - 20);
    expect(creatureOf(s, hard).xp).toBe(35 - 5);
  });

  it('hoy suma al momento y nunca resta', () => {
    const h = makeHabit({ startDate: START });
    const pending = game({ habits: [h], logs: [makeLog(h, START)], today: '2026-09-02' });
    expect(creatureOf(pending, h).xp).toBe(25);
    expect(creatureOf(pending, h).xpToday).toBe(0);
    const done = game({ habits: [h], logs: logsFor(h, START, '2026-09-02'), today: '2026-09-02' });
    expect(creatureOf(done, h).xp).toBe(50);
    expect(creatureOf(done, h).xpToday).toBe(25);
  });

  it('saltado, no programado y vacaciones son neutros', () => {
    const skip = makeHabit({ startDate: START });
    const mondays = makeHabit({
      startDate: START,
      config: { schedule: { type: 'weekdays', days: [1] } },
    });
    const vac = makeHabit({ startDate: START });
    const vacation = makeVacation({
      startDate: '2026-09-02',
      endDate: '2026-09-03',
      createdAt: noon(START),
    });
    const s = game({
      habits: [skip, mondays, vac],
      logs: [makeLog(skip, START), makeLog(skip, '2026-09-02', 'skipped'), makeLog(vac, START)],
      vacations: [vacation],
      today: '2026-09-04',
    });
    // skip: +25 el día 1, saltado el 2 (neutro), vacaciones el 3 (neutro).
    expect(creatureOf(s, skip).xp).toBe(25);
    // Solo lunes: entre el martes 1 y el jueves 3 no le tocaba ningún día.
    expect(creatureOf(s, mondays).xp).toBe(0);
    expect(creatureOf(s, mondays).history).toEqual([]);
    expect(creatureOf(s, vac).xp).toBe(25);
  });

  it('frecuencia flexible: lo que falte del objetivo resta al cerrar la semana', () => {
    // Semana del lunes 7 al domingo 13 de septiembre: objetivo 3, hechos 2.
    const h = makeHabit({
      startDate: '2026-09-07',
      config: { schedule: { type: 'timesPerWeek', times: 3 } },
    });
    const s = game({
      habits: [h],
      logs: [makeLog(h, '2026-09-07'), makeLog(h, '2026-09-08')],
      today: '2026-09-14',
    });
    expect(creatureOf(s, h).xp).toBe(25 + 25 - 15);
  });

  it('el primer periodo a medias de un hábito flexible exige la parte proporcional', () => {
    // 3 veces por semana, creado el sábado 12: solo 2 de los 7 días de esa semana.
    const h = makeHabit({
      startDate: '2026-09-12',
      config: { schedule: { type: 'timesPerWeek', times: 3 } },
    });
    const s = game({ habits: [h], logs: [makeLog(h, '2026-09-12')], today: '2026-09-14' });
    // Objetivo proporcional: ceil(3 × 2 / 7) = 1, cumplido con un solo día.
    expect(creatureOf(s, h).xp).toBe(25);
    expect(creatureOf(s, h).mood).toBe('normal');
  });

  it('la XP nunca baja de 0', () => {
    const h = makeHabit({ startDate: START, config: { effort: 1 } });
    const s = game({ habits: [h], today: '2026-09-20' });
    expect(creatureOf(s, h).xp).toBe(0);
  });

  it('bonus de racha: +5 % a partir de la primera semana seguida', () => {
    const h = makeHabit({ startDate: START });
    const s = game({ habits: [h], logs: logsFor(h, START, '2026-09-08'), today: '2026-09-09' });
    expect(creatureOf(s, h).xp).toBe(7 * 25 + Math.round(25 * 1.05));
  });

  it('cambiar el esfuerzo solo afecta desde el cambio', () => {
    const h = makeHabit({
      startDate: START,
      configHistory: [
        { since: START, effort: 1, schedule: { type: 'daily' }, target: null },
        { since: '2026-09-03', effort: 5, schedule: { type: 'daily' }, target: null },
      ],
    });
    const s = game({ habits: [h], logs: logsFor(h, START, '2026-09-03'), today: '2026-09-04' });
    expect(creatureOf(s, h).xp).toBe(15 + 15 + 35);
  });
});

describe('motor de criaturas: etapas y ánimo', () => {
  it('eclosiona al llegar a 50 XP y lo apunta en su historia', () => {
    const h = makeHabit({ startDate: START });
    const s = game({ habits: [h], logs: logsFor(h, START, '2026-09-02'), today: '2026-09-03' });
    const c = creatureOf(s, h);
    expect(c.stage).toBe(1);
    expect(c.history).toEqual([{ date: '2026-09-02', type: 'hatch', stage: 1 }]);
    expect(c.maxStageEver).toBe(1);
  });

  it('retrocede solo al caer por debajo del 80 % del umbral', () => {
    const h = makeHabit({ startDate: START, config: { effort: 1 } });
    // 4 días hechos: 15 × 4 = 60 → bebé. Luego un fallo de −25: 35 < 40.
    const logs = logsFor(h, START, '2026-09-04');
    expect(creatureOf(game({ habits: [h], logs, today: '2026-09-05' }), h).stage).toBe(1);
    const c = creatureOf(game({ habits: [h], logs, today: '2026-09-06' }), h);
    expect(c.stage).toBe(0);
    expect(c.history.at(-1)).toEqual({ date: '2026-09-05', type: 'demote', stage: 0 });
    expect(c.maxStageEver).toBe(1);
  });

  it('ánimo según los últimos 7 días programados', () => {
    const happy = makeHabit({ startDate: START });
    const sad = makeHabit({ startDate: START });
    const fresh = makeHabit({ startDate: '2026-09-09' });
    const s = game({
      habits: [happy, sad, fresh],
      logs: [...logsFor(happy, START, '2026-09-09'), makeLog(sad, '2026-09-09')],
      today: '2026-09-10',
    });
    expect(creatureOf(s, happy).mood).toBe('feliz');
    expect(creatureOf(s, sad).mood).toBe('triste');
    expect(creatureOf(s, fresh).mood).toBe('normal');
  });
});

describe('motor de criaturas: entrenador y reglas contra trampas', () => {
  it('la XP de entrenador suma solo lo ganado y da el nivel', () => {
    const h = makeHabit({ startDate: START, config: { effort: 1 } });
    // +15, −25 (se queda en 0), +15: la criatura tiene 15 y el entrenador 30.
    const s = game({
      habits: [h],
      logs: [makeLog(h, START), makeLog(h, '2026-09-03')],
      today: '2026-09-04',
    });
    expect(creatureOf(s, h).xp).toBe(15);
    expect(s.trainerXp).toBe(30);
    expect(s.level).toBe(1);
    expect(s.unlockedSpecies).toHaveLength(6);
  });

  it('borrar o archivar un hábito no baja la XP de entrenador', () => {
    const h = makeHabit({ startDate: START });
    const logs = logsFor(h, START, '2026-09-05');
    const before = game({ habits: [h], logs, today: '2026-09-06' });
    const deleted = { ...h, deletedAt: noon('2026-09-06') };
    const archived = { ...h, archivedAt: noon('2026-09-06') };
    const afterDelete = game({ habits: [deleted], logs, today: '2026-09-20' });
    const afterArchive = game({ habits: [archived], logs, today: '2026-09-20' });
    expect(afterDelete.trainerXp).toBe(before.trainerXp);
    expect(afterDelete.creatures).toEqual([]);
    expect(afterArchive.trainerXp).toBe(before.trainerXp);
    const c = creatureOf(afterArchive, archived);
    expect(c.archived).toBe(true);
    expect(c.xp).toBe(creatureOf(before, h).xp);
  });

  it('un hábito sin especie usa la de por defecto', () => {
    const h = makeHabit({ startDate: START });
    const named = makeHabit({ startDate: START, creatureSpecies: 'medusa', creatureName: 'Mery' });
    const s = game({ habits: [h, named], today: START });
    expect(creatureOf(s, h).species).toBe(defaultSpecies(h.id));
    expect(creatureOf(s, named)).toMatchObject({ species: 'medusa', name: 'Mery' });
    expect(s.seenStages.medusa).toEqual([]);
  });

  it('el resultado no depende del orden de los datos', () => {
    const habits = [1, 2, 3].map((i) => makeHabit({ name: `h${i}`, startDate: START }));
    const logs = habits.flatMap((h, i) =>
      [...eachDay(START, '2026-09-20')]
        .filter((_, n) => (n + i) % 3 !== 0)
        .map((d) => makeLog(h, d)),
    );
    const reference = game({ habits, logs, today: '2026-09-21' });
    fc.assert(
      fc.property(
        fc.shuffledSubarray(habits, { minLength: habits.length }),
        fc.shuffledSubarray(logs, { minLength: logs.length }),
        (hs, ls) => {
          expect(game({ habits: hs, logs: ls, today: '2026-09-21' })).toEqual(reference);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------- Economía ----------

const purchase = (item: string, date: string, price: number): Purchase => ({
  id: newId(),
  createdAt: noon(date),
  updatedAt: noon(date),
  deletedAt: null,
  item,
  date,
  price,
});

describe('pesetas', () => {
  it('hacer un hábito da tantas pesetas como su esfuerzo', () => {
    const h = makeHabit({ startDate: START, config: { effort: 4 } });
    expect(game({ habits: [h], logs: [makeLog(h, START)], today: '2026-09-02' }).pesetas).toBe(4);
  });

  it('los logros dan su premio el día que se consiguen', () => {
    const h = makeHabit({ startDate: START });
    const s = game({ habits: [h], logs: logsFor(h, START, '2026-09-02'), today: '2026-09-03' });
    const hatch = s.achievements.find((a) => a.id === 'primera-eclosion')!;
    expect(hatch.unlockedOn).toBe('2026-09-02');
    expect(s.pesetas).toBe(3 + 3 + hatch.reward);
    expect(s.achievements.find((a) => a.id === 'primera-leyenda')!.unlockedOn).toBeNull();
  });

  it('una compra resta su precio desde su fecha', () => {
    const h = makeHabit({ startDate: START, config: { effort: 5 } });
    const logs = logsFor(h, START, '2026-09-20');
    const without = game({ habits: [h], logs, today: '2026-09-21' });
    const withBuy = game({
      habits: [h],
      logs,
      purchases: [purchase('background:playa', '2026-09-20', 150)],
      today: '2026-09-21',
    });
    expect(without.pesetas - withBuy.pesetas).toBe(150);
    expect(withBuy.owned).toEqual(['background:playa']);
  });

  it('compras que dejarían el saldo en negativo: 0 pesetas y lo comprado se queda', () => {
    const s = game({
      purchases: [
        purchase('background:playa', '2026-09-01', 150),
        purchase('background:dojo', '2026-09-01', 150),
      ],
      today: '2026-09-02',
    });
    expect(s.pesetas).toBe(0);
    expect([...s.owned].sort()).toEqual(['background:dojo', 'background:playa']);
  });
});

describe('pesetas por tareas', () => {
  const created = noon('2026-09-01');
  const done = (over: Parameters<typeof makeTask>[0]) =>
    makeTask({ createdAt: created, status: 'done', completedAt: noon('2026-09-02'), ...over });

  it('alta 3, media 2, baja 1, si se crearon un día antes o más', () => {
    const s = game({
      tasks: [done({ priority: 1 }), done({ priority: 2 }), done({ priority: 3 })],
      today: '2026-09-03',
    });
    expect(s.pesetas).toBe(6);
  });

  it('una tarea creada y completada el mismo día no da nada', () => {
    const s = game({ tasks: [done({ createdAt: noon('2026-09-02') })], today: '2026-09-03' });
    expect(s.pesetas).toBe(0);
  });

  it('como mucho 15 pesetas al día por tareas', () => {
    // 6 tareas de prioridad alta (18) superan el tope sin llegar al logro de 10 tareas.
    const tasks = Array.from({ length: 6 }, () => done({ priority: 1 }));
    expect(game({ tasks, today: '2026-09-03' }).pesetas).toBe(15);
  });

  it('cada repetición completada de una tarea recurrente cuenta', () => {
    const task = makeTask({ createdAt: created, priority: 1, rrule: 'FREQ=DAILY' });
    const completion: TaskCompletion = {
      id: deterministicId('taskCompletion', task.id, '2026-09-02'),
      createdAt: noon('2026-09-02'),
      updatedAt: noon('2026-09-02'),
      deletedAt: null,
      taskId: task.id,
      occurrenceDate: '2026-09-02',
      completedAt: noon('2026-09-02'),
    };
    expect(
      game({ tasks: [task], taskCompletions: [completion], today: '2026-09-03' }).pesetas,
    ).toBe(3);
  });

  it('una tarea reabierta, o borrada el mismo día, deja de dar pesetas', () => {
    const reopened = done({ status: 'pending', completedAt: null });
    const deleted = done({ deletedAt: noon('2026-09-02') });
    expect(game({ tasks: [reopened, deleted], today: '2026-09-03' }).pesetas).toBe(0);
  });

  it('borrar días después una tarea ya completada (vaciar completadas) no quita lo ganado', () => {
    const cleaned = done({ priority: 1, deletedAt: noon('2026-09-05') });
    const task = makeTask({ createdAt: created, priority: 2, deletedAt: noon('2026-09-05') });
    const completion: TaskCompletion = {
      id: deterministicId('taskCompletion', task.id, '2026-09-02'),
      createdAt: noon('2026-09-02'),
      updatedAt: noon('2026-09-02'),
      deletedAt: null,
      taskId: task.id,
      occurrenceDate: '2026-09-02',
      completedAt: noon('2026-09-02'),
    };
    const s = game({ tasks: [cleaned, task], taskCompletions: [completion], today: '2026-09-06' });
    expect(s.pesetas).toBe(3 + 2);
  });
});

describe('comodines', () => {
  it('se gastan solos el primer día cerrado con fallos posterior a la compra', () => {
    const h = makeHabit({ startDate: START });
    const logs = logsFor(h, START, '2026-09-08').filter((l) => l.date !== '2026-09-07');
    const s = game({
      habits: [h],
      logs,
      purchases: [purchase('freeze', '2026-09-05', 50)],
      today: '2026-09-09',
    });
    expect(s.frozenDays).toEqual(['2026-09-07']);
    expect(s.freezes).toBe(0);
    // El 7 no resta ni rompe la racha: 6 días seguidos + el 8 sigue la racha (7 → bonus).
    const c = creatureOf(s, h);
    expect(c.streak).toBe(7);
    expect(c.xp).toBe(7 * 25);
  });

  it('no protege el día de la compra ni días sin fallos', () => {
    const h = makeHabit({ startDate: START });
    const logs = logsFor(h, START, '2026-09-08').filter((l) => l.date !== '2026-09-05');
    const s = game({
      habits: [h],
      logs,
      purchases: [purchase('freeze', '2026-09-05', 50)],
      today: '2026-09-09',
    });
    expect(s.frozenDays).toEqual([]);
    expect(s.freezes).toBe(1);
  });
});

describe('logros', () => {
  it('colección completa cuando las 16 especies han eclosionado alguna vez', () => {
    const habits = SPECIES.map((sp) => makeHabit({ startDate: START, creatureSpecies: sp.id }));
    const logs = habits.flatMap((h) => logsFor(h, START, '2026-09-02'));
    const s = game({ habits, logs, today: '2026-09-03' });
    expect(s.achievements.find((a) => a.id === 'coleccion-completa')!.unlockedOn).toBe(
      '2026-09-02',
    );
    expect(Object.values(s.seenStages).every((stages) => stages.includes(1))).toBe(true);
  });
});

// ---------- Arreglos de la revisión ----------

describe('deuda de pesetas', () => {
  it('lo comprado sin saldo se paga con lo que se gane después', () => {
    const h = makeHabit({ startDate: '2026-09-02', config: { effort: 5 } });
    const logs = logsFor(h, '2026-09-02', '2026-09-30');
    const without = game({ habits: [h], logs, today: '2026-10-01' });
    const withDebt = game({
      habits: [h],
      logs,
      purchases: [purchase('background:playa', '2026-09-01', 150)],
      today: '2026-10-01',
    });
    expect(without.pesetas - withDebt.pesetas).toBe(150);
  });

  it('mientras hay deuda se ven 0 pesetas', () => {
    const s = game({
      purchases: [purchase('aura:dorada', '2026-09-01', 200)],
      today: '2026-09-02',
    });
    expect(s.pesetas).toBe(0);
  });
});

describe('tope de comodines', () => {
  it('nunca se guardan más del máximo, aunque se compren desde dos dispositivos', () => {
    const s = game({
      purchases: [1, 2, 3].map(() => purchase('freeze', '2026-09-01', 50)),
      today: '2026-09-02',
    });
    expect(s.freezes).toBe(DEFAULT_CREATURE_RULES.freezeMax);
  });
});

describe('XP que da hacer un hábito', () => {
  it('incluye el bonus de racha', () => {
    const daily = makeHabit().configHistory[0]!;
    expect(habitXpGain(daily, 0)).toBe(25);
    expect(habitXpGain(daily, 7)).toBe(26);
    const weekly = makeHabit({ config: { schedule: { type: 'timesPerWeek', times: 3 } } })
      .configHistory[0]!;
    expect(habitXpGain(weekly, 2)).toBe(Math.round(25 * 1.1));
  });
});

describe('avisos de retroceso', () => {
  const easy = () => makeHabit({ startDate: START, config: { effort: 1 } });

  it('avisa si fallar hoy la haría retroceder', () => {
    const h = easy();
    // 60 XP (bebé): fallar hoy deja 35, por debajo del 80 % de 50.
    const s = game({ habits: [h], logs: logsFor(h, START, '2026-09-04'), today: '2026-09-05' });
    expect(s.alerts.map((a) => a.habitId)).toEqual([h.id]);
  });

  it('no avisa si ya lo ha hecho hoy', () => {
    const h = easy();
    const s = game({ habits: [h], logs: logsFor(h, START, '2026-09-05'), today: '2026-09-05' });
    expect(s.alerts).toEqual([]);
  });

  it('no avisa con huevos', () => {
    const h = easy();
    expect(game({ habits: [h], today: '2026-09-10' }).alerts).toEqual([]);
  });

  it('no avisa si va sobrada de XP', () => {
    const h = makeHabit({ startDate: START });
    // 75 XP y fallar quita 15: se queda en 60, sigue siendo bebé.
    const s = game({ habits: [h], logs: logsFor(h, START, '2026-09-03'), today: '2026-09-04' });
    expect(s.alerts).toEqual([]);
  });

  it('no avisa si hay un comodín guardado o está de vacaciones', () => {
    const h = easy();
    const logs = logsFor(h, START, '2026-09-04');
    const freeze = game({
      habits: [h],
      logs,
      purchases: [purchase('freeze', '2026-09-03', 50)],
      today: '2026-09-05',
    });
    expect(freeze.alerts).toEqual([]);
    const vacation = makeVacation({
      startDate: '2026-09-05',
      endDate: '2026-09-06',
      createdAt: noon(START),
    });
    expect(game({ habits: [h], logs, vacations: [vacation], today: '2026-09-05' }).alerts).toEqual(
      [],
    );
  });

  it('en los flexibles solo avisa el día que se cierra el periodo', () => {
    const h = makeHabit({
      startDate: '2026-08-31',
      config: { effort: 1, schedule: { type: 'timesPerWeek', times: 3 } },
    });
    // Primera semana: 4 veces (60 XP). Segunda: solo el lunes.
    const logs = [...logsFor(h, '2026-08-31', '2026-09-03'), makeLog(h, '2026-09-07')];
    expect(game({ habits: [h], logs, today: '2026-09-09' }).alerts).toEqual([]);
    expect(game({ habits: [h], logs, today: '2026-09-13' }).alerts.map((a) => a.habitId)).toEqual([
      h.id,
    ]);
  });
});

describe('la colección no olvida especies', () => {
  const game = (h: Habit) =>
    computeGame({
      habits: [h],
      logs: [],
      tasks: [],
      taskCompletions: [],
      purchases: [],
      vacations: [],
      today: '2026-11-04',
    });

  it('una especie abandonada sigue vista con las etapas que alcanzó', () => {
    const g = game(makeHabit({ creaturePast: [{ species: 'medusa', maxStage: 2 }] }));
    expect(g.seenStages.medusa).toEqual([1, 2]);
  });

  it('pasar por las especies no paga el logro de la colección, aunque se vean en ella', () => {
    const past = SPECIES.map((s) => ({ species: s.id, maxStage: 1 }));
    const g = game(makeHabit({ creaturePast: past }));
    expect(g.achievements.find((a) => a.id === 'coleccion-completa')?.unlockedOn).toBeNull();
    expect(g.seenStages.medusa).toEqual([1]);
  });

  it('una especie desconocida se ignora', () => {
    const g = game(makeHabit({ creaturePast: [{ species: 'pikachu', maxStage: 4 }] }));
    expect(Object.keys(g.seenStages)).toHaveLength(16);
  });
});
