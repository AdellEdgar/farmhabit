import { describe, expect, it } from 'vitest';
import { computeFarm } from '../src/game/engine';
import type { FarmInput } from '../src/game/engine';
import { DEFAULT_RULES, levelForXp } from '../src/game/game-rules';
import type { Habit, HabitLog } from '../src/model/types';
import { eachDay } from '../src/util/dates';
import { deterministicId } from '../src/util/ids';
import { makeAnimal, makeHabit, makeLog, makeVacation, noon } from './helpers/fixtures';

// Los hábitos empiezan el 1 de septiembre: del 1 al 7 están en periodo de
// gracia (no cuentan para el bienestar). 2026-09-07 es lunes.
const START = '2026-09-01';

function farm(input: Partial<FarmInput> & { today: string }) {
  return computeFarm({ habits: [], logs: [], animals: [], vacations: [], ...input });
}

function logsFor(habit: Habit, from: string, to: string): HabitLog[] {
  return [...eachDay(from, to)].map((d) => makeLog(habit, d));
}

const day = (state: ReturnType<typeof farm>, date: string) => {
  const r = state.days.find((d) => d.date === date);
  if (!r) throw new Error(`No hay resultado para ${date}`);
  return r;
};

const three = () => [1, 2, 3].map((i) => makeHabit({ name: `h${i}`, startDate: START }));

describe('puntos', () => {
  it('hacer suma 10 × esfuerzo y no hacer resta 10 × (6 − esfuerzo)', () => {
    const big = makeHabit({ startDate: START, config: { effort: 5 } });
    const mid = makeHabit({ startDate: START, config: { effort: 4 } });
    const s = farm({ habits: [big, mid], logs: [makeLog(big, START)], today: '2026-09-02' });
    expect(day(s, START)).toMatchObject({ earned: 50, penalty: 20 });
    expect(s.xp).toBe(50); // la XP solo sube
    expect(s.grain).toBe(30); // el grano descuenta penalizaciones
  });

  it('fallar un hábito fácil penaliza más que uno difícil', () => {
    const easy = makeHabit({ startDate: START, config: { effort: 1 } });
    const hard = makeHabit({ startDate: START, config: { effort: 5 } });
    expect(day(farm({ habits: [easy], today: '2026-09-02' }), START).penalty).toBe(50);
    expect(day(farm({ habits: [hard], today: '2026-09-02' }), START).penalty).toBe(10);
  });

  it('saltado es neutro', () => {
    const h = makeHabit({ startDate: START, config: { effort: 1 } });
    const s = farm({ habits: [h], logs: [makeLog(h, START, 'skipped')], today: '2026-09-02' });
    expect(day(s, START)).toMatchObject({ earned: 0, penalty: 0 });
  });

  it('las cantidades dan puntos y penalización proporcionales', () => {
    const water = makeHabit({
      startDate: START,
      config: { effort: 2, target: { quantity: 2, unit: 'L' } },
    });
    const s = farm({
      habits: [water],
      logs: [makeLog(water, START, 'done', 1.5)],
      today: '2026-09-02',
    });
    expect(day(s, START)).toMatchObject({ earned: 15, penalty: 10 }); // 75 % de 20 y 25 % de 40
  });

  it('la racha da un bonus a partir de la primera semana', () => {
    const h = makeHabit({ startDate: START, config: { effort: 5 } });
    const s = farm({ habits: [h], logs: logsFor(h, START, '2026-09-08'), today: '2026-09-09' });
    expect(day(s, '2026-09-07').earned).toBe(50);
    expect(day(s, '2026-09-08').earned).toBe(53); // 50 × 1,05
  });

  it('hoy es provisional: suma lo hecho pero no penaliza lo pendiente', () => {
    const done = makeHabit({ startDate: START, config: { effort: 3 } });
    const pending = makeHabit({ startDate: START, config: { effort: 1 } });
    const s = farm({ habits: [done, pending], logs: [makeLog(done, START)], today: START });
    expect(s.todayProgress).toMatchObject({ earned: 30, penalty: 0 });
    expect(s.xp).toBe(30);
    expect(s.days).toHaveLength(0);
  });

  it('sube de nivel con la XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(199)).toBe(1);
    expect(levelForXp(200)).toBe(2);
    expect(levelForXp(600)).toBe(3);
    const h = makeHabit({ startDate: START, config: { effort: 5 } });
    const s = farm({ habits: [h], logs: logsFor(h, START, '2026-09-04'), today: '2026-09-05' });
    expect(s.level).toBe(2);
    expect(s.days.flatMap((d) => d.events)).toContainEqual({ type: 'levelUp', level: 2 });
  });
});

describe('bienestar', () => {
  const scenario = (logsOn11: (hs: Habit[]) => HabitLog[], habits = three()) => {
    const logs = [...habits.flatMap((h) => logsFor(h, START, '2026-09-10')), ...logsOn11(habits)];
    return day(farm({ habits, logs, today: '2026-09-12' }), '2026-09-11');
  };

  it('90 % o más sube 12', () => {
    expect(scenario((hs) => hs.map((h) => makeLog(h, '2026-09-11'))).wellbeingDelta).toBe(12);
  });

  it('entre 40 y 69 % baja 5', () => {
    const r = scenario((hs) => hs.slice(0, 2).map((h) => makeLog(h, '2026-09-11')));
    expect(r.compliance).toBeCloseTo(2 / 3);
    expect(r.wellbeingDelta).toBe(-5);
  });

  it('menos del 40 % baja 15', () => {
    expect(scenario(() => []).wellbeingDelta).toBe(-15);
  });

  it('un cumplimiento alto con menos de 3 hábitos hechos no recupera', () => {
    const habits = [5, 5, 1, 1, 1].map((effort, i) =>
      makeHabit({ name: `e${i}`, startDate: START, config: { effort } }),
    );
    const r = scenario((hs) => hs.slice(0, 2).map((h) => makeLog(h, '2026-09-11')), habits);
    expect(r.compliance).toBeCloseTo(10 / 13);
    expect(r.doneCount).toBe(2);
    expect(r.wellbeingDelta).toBe(DEFAULT_RULES.notEnoughHabitsDelta);
  });

  it('hacer solo lo fácil no basta', () => {
    const habits = [1, 5, 5].map((effort, i) =>
      makeHabit({ name: `e${i}`, startDate: START, config: { effort } }),
    );
    const r = scenario((hs) => [makeLog(hs[0]!, '2026-09-11')], habits);
    expect(r.compliance).toBeCloseTo(1 / 11);
    expect(r.wellbeingDelta).toBe(-15);
  });

  it('los hábitos nuevos (menos de 7 días) no cuentan para recuperar', () => {
    const old = makeHabit({ name: 'viejo', startDate: START });
    const fresh = makeHabit({ name: 'nuevo', startDate: '2026-09-09' });
    const logs = [...logsFor(old, START, '2026-09-10'), makeLog(fresh, '2026-09-11')];
    const r = day(farm({ habits: [old, fresh], logs, today: '2026-09-12' }), '2026-09-11');
    expect(r.compliance).toBe(0);
    expect(r.earned).toBe(30); // pero sí da puntos
  });

  it('nunca pasa de 100 ni baja de 0', () => {
    const hs = three();
    const good = farm({
      habits: hs,
      logs: hs.flatMap((h) => logsFor(h, START, '2026-10-30')),
      today: '2026-10-31',
    });
    expect(good.wellbeing).toBe(100);
    const bad = farm({ habits: hs, today: '2026-10-31' });
    expect(bad.wellbeing).toBe(0);
  });
});

describe('enfermedad y muerte', () => {
  // Sin registros: gracia hasta el 7 (80), luego −15 al día:
  // 8→65, 9→50, 10→35, 11→20 (enferman), 12→5, 13→0 (3er día: muere uno).
  const habits = three();
  const animals = [
    makeAnimal({ name: 'Lola', acquiredOn: START }),
    makeAnimal({ name: 'Copito', species: 'rabbit', acquiredOn: START }),
  ];

  it('enferman por debajo del 30 % y al tercer día muere uno para siempre', () => {
    const s = farm({ habits, animals, today: '2026-09-14' });
    expect(day(s, '2026-09-11').events).toContainEqual({ type: 'sick' });
    expect(day(s, '2026-09-12').events).toEqual([]);
    const deaths = day(s, '2026-09-13').events.filter((e) => e.type === 'death');
    expect(deaths).toHaveLength(1);
    expect(s.animals.filter((a) => a.diedOn === '2026-09-13')).toHaveLength(1);
    expect(s.sick).toBe(true);
  });

  it('avisa antes de morir y el aviso acierta con el animal', () => {
    const warned = farm({ habits, animals, today: '2026-09-12' });
    expect(warned.deathWarning?.daysLeft).toBe(2);
    const later = farm({ habits, animals, today: '2026-09-14' });
    const dead = later.animals.find((a) => a.diedOn !== null);
    expect(warned.deathWarning?.animalId).toBe(dead?.id);
    expect(warned.deathWarning?.name).toBe(dead?.name);
  });

  it('un animal muerto no revive aunque luego se cumpla todo', () => {
    const logs = habits.flatMap((h) => logsFor(h, '2026-09-14', '2026-10-20'));
    const s = farm({ habits, animals, logs, today: '2026-10-21' });
    expect(s.sick).toBe(false);
    expect(s.animals.filter((a) => a.diedOn !== null)).toHaveLength(1);
  });

  it('curarse exige 2 días buenos seguidos, no basta uno', () => {
    // 11→20 (enfermos); 12 bueno → 32 (sigue enfermo); 13 bueno → 44 (curado).
    const logs = habits.flatMap((h) => logsFor(h, '2026-09-12', '2026-09-13'));
    const s = farm({ habits, animals, logs, today: '2026-09-14' });
    expect(day(s, '2026-09-12').wellbeing).toBe(32);
    expect(day(s, '2026-09-12').events).not.toContainEqual({ type: 'healed' });
    expect(day(s, '2026-09-13').events).toContainEqual({ type: 'healed' });
    expect(s.animals.every((a) => a.diedOn === null)).toBe(true);
  });
});

describe('modo vacaciones', () => {
  const habits = three();

  it('activado de antemano congela el bienestar', () => {
    const v = makeVacation({
      startDate: '2026-09-08',
      endDate: '2026-09-10',
      createdAt: noon('2026-09-05'),
    });
    const s = farm({ habits, vacations: [v], today: '2026-09-12' });
    for (const d of ['2026-09-08', '2026-09-09', '2026-09-10']) {
      expect(day(s, d)).toMatchObject({ vacation: true, wellbeingDelta: 0, penalty: 0 });
    }
    expect(day(s, '2026-09-11').wellbeingDelta).toBe(-15);
  });

  it('activado a posteriori no protege los días ya empezados', () => {
    const v = makeVacation({
      startDate: '2026-09-08',
      endDate: '2026-09-10',
      createdAt: noon('2026-09-09'),
    });
    const s = farm({ habits, vacations: [v], today: '2026-09-12' });
    expect(day(s, '2026-09-08').vacation).toBe(false);
    expect(day(s, '2026-09-09').vacation).toBe(false);
    expect(day(s, '2026-09-10').vacation).toBe(true);
  });
});

describe('contra las trampas', () => {
  it('borrar un hábito no borra sus penalizaciones pasadas', () => {
    const h = makeHabit({ startDate: START, config: { effort: 1 }, deletedAt: noon('2026-09-03') });
    const s = farm({ habits: [h], today: '2026-09-05' });
    expect(day(s, '2026-09-02').penalty).toBe(50);
    expect(day(s, '2026-09-03').penalty).toBe(0);
  });

  it('cambiar el esfuerzo solo afecta desde el cambio', () => {
    const h = makeHabit({
      startDate: START,
      configHistory: [
        { since: START, effort: 1, schedule: { type: 'daily' }, target: null },
        { since: '2026-09-03', effort: 5, schedule: { type: 'daily' }, target: null },
      ],
    });
    const s = farm({ habits: [h], today: '2026-09-04' });
    expect(day(s, '2026-09-02').penalty).toBe(50);
    expect(day(s, '2026-09-03').penalty).toBe(10);
  });
});

describe('frecuencias flexibles', () => {
  it('lo que falta del objetivo semanal se penaliza el domingo', () => {
    const h = makeHabit({
      startDate: '2026-09-07',
      config: { effort: 3, schedule: { type: 'timesPerWeek', times: 3 } },
    });
    const logs = [makeLog(h, '2026-09-08'), makeLog(h, '2026-09-10')];
    const s = farm({ habits: [h], logs, today: '2026-09-14' });
    expect(day(s, '2026-09-08')).toMatchObject({ earned: 30, penalty: 0 });
    expect(day(s, '2026-09-12').penalty).toBe(0);
    expect(day(s, '2026-09-13').penalty).toBe(30); // falta 1 vez
  });
});

describe('granja', () => {
  it('nacen crías tras 7 días contentos, con nombre del usuario si lo tiene', () => {
    const habits = three();
    const parent = makeAnimal({ name: 'Lola', acquiredOn: START });
    const logs = habits.flatMap((h) => logsFor(h, START, '2026-09-08'));
    const s = farm({ habits, logs, animals: [parent], today: '2026-09-09' });
    const babyId = deterministicId('birth', parent.id, '2026-09-07');
    expect(day(s, '2026-09-07').events).toContainEqual({ type: 'birth', animalId: babyId });
    const baby = s.animals.find((a) => a.id === babyId);
    expect(baby).toMatchObject({ species: 'chicken', source: 'born', diedOn: null });

    const named = makeAnimal({ id: babyId, name: 'Pío', source: 'born', acquiredOn: '2026-09-07' });
    const s2 = farm({ habits, logs, animals: [parent, named], today: '2026-09-09' });
    expect(s2.animals.find((a) => a.id === babyId)?.name).toBe('Pío');
  });

  it('comprar un animal gasta grano', () => {
    const h = makeHabit({ startDate: START, config: { effort: 5 } });
    const logs = logsFor(h, START, '2026-09-04');
    const cow = makeAnimal({
      species: 'cow',
      source: 'bought',
      price: 120,
      acquiredOn: '2026-09-04',
    });
    const s = farm({ habits: [h], logs, animals: [cow], today: '2026-09-05' });
    expect(s.grain).toBe(4 * 50 - 120);
    expect(s.animals).toHaveLength(1);
  });

  it('el resultado no depende del orden de los datos', () => {
    const habits = three();
    const animals = [
      makeAnimal({ acquiredOn: START }),
      makeAnimal({ name: 'B', acquiredOn: START }),
    ];
    const logs = habits.flatMap((h) => logsFor(h, '2026-09-20', '2026-09-25'));
    const a = farm({ habits, animals, logs, today: '2026-09-30' });
    const b = farm({
      habits: [...habits].reverse(),
      animals: [...animals].reverse(),
      logs: [...logs].reverse(),
      today: '2026-09-30',
    });
    expect(b).toEqual(a);
  });
});
