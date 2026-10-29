import {
  configOn,
  isActiveOn,
  isFlexible,
  isScheduledOn,
  logRatio,
  periodOf,
} from '../domain/habits';
import type { Animal, Habit, HabitLog, Species, Vacation } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, diffDays, localDateOf } from '../util/dates';
import { fnv1a } from '../util/hash';
import { deterministicId } from '../util/ids';
import type { GameRules } from './game-rules';
import { DEFAULT_ANIMAL_NAMES, DEFAULT_RULES, levelForXp } from './game-rules';

// Motor de la granja. El estado NO se guarda: se recalcula día a día desde el
// historial de hábitos, así todos los dispositivos ven la misma granja.
// Los días anteriores a hoy están cerrados; hoy es provisional (suma puntos,
// pero no cambia bienestar ni mata animales).

export interface FarmInput {
  habits: Habit[];
  logs: HabitLog[];
  animals: Animal[];
  vacations: Vacation[];
  today: LocalDate;
  rules?: GameRules;
}

export interface FarmAnimal {
  id: string;
  name: string;
  species: Species;
  acquiredOn: LocalDate;
  source: Animal['source'];
  diedOn: LocalDate | null;
}

export type FarmEvent =
  | { type: 'death'; animalId: string }
  | { type: 'birth'; animalId: string }
  | { type: 'levelUp'; level: number }
  | { type: 'sick' }
  | { type: 'healed' };

export interface DayResult {
  date: LocalDate;
  earned: number;
  penalty: number;
  /** null si ese día no tocaba ningún hábito que cuente. */
  compliance: number | null;
  doneCount: number;
  scheduledCount: number;
  vacation: boolean;
  wellbeingDelta: number;
  wellbeing: number;
  events: FarmEvent[];
}

export interface FarmState {
  today: LocalDate;
  xp: number;
  level: number;
  grain: number;
  wellbeing: number;
  sick: boolean;
  daysBelowThreshold: number;
  goodStreak: number;
  animals: FarmAnimal[];
  deathWarning: { animalId: string; name: string; daysLeft: number } | null;
  days: DayResult[];
  todayProgress: Omit<DayResult, 'wellbeingDelta' | 'wellbeing' | 'events'>;
}

interface HabitTrack {
  /** Racha en días (frecuencia fija) o en periodos (flexible). */
  streak: number;
}

/** Elecciones deterministas (víctima, padre, nombre). Ver util/hash.ts. */
const hash = fnv1a;

function pick<T extends { id: string }>(items: T[], seed: string): T | undefined {
  let best: T | undefined;
  let bestHash = Infinity;
  for (const it of items) {
    const h = hash(`${seed}|${it.id}`);
    if (h < bestHash) {
      bestHash = h;
      best = it;
    }
  }
  return best;
}

function isVacationDay(vacations: Vacation[], date: LocalDate): boolean {
  // Solo cuenta si se activó ANTES de ese día (no vale activarla a posteriori).
  return vacations.some(
    (v) =>
      v.deletedAt === null &&
      v.startDate <= date &&
      date <= v.endDate &&
      localDateOf(v.createdAt) < date,
  );
}

function streakMultiplier(rules: GameRules, weeks: number): number {
  return 1 + Math.min(rules.streakBonusMax, rules.streakBonusPerWeek * weeks);
}

export function computeFarm(input: FarmInput): FarmState {
  const rules = input.rules ?? DEFAULT_RULES;
  const { today } = input;
  // Orden fijo para que el resultado no dependa del orden de los datos.
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const habits = [...input.habits].sort(byId);
  const vacations = input.vacations;

  const logIndex = new Map<string, HabitLog>();
  for (const l of input.logs) if (l.deletedAt === null) logIndex.set(`${l.habitId}|${l.date}`, l);
  const logOf = (habitId: string, date: LocalDate) => logIndex.get(`${habitId}|${date}`);

  const userAnimals = input.animals.filter((a) => a.deletedAt === null);
  const namesById = new Map(userAnimals.map((a) => [a.id, a.name]));
  const farmAnimals: FarmAnimal[] = [];
  const purchases = userAnimals.filter((a) => a.source !== 'born').sort(byId);

  const starts = [...habits.map((h) => h.startDate), ...purchases.map((a) => a.acquiredOn)].sort();
  const firstDay = starts[0] ?? today;

  const tracks = new Map<string, HabitTrack>();
  const track = (id: string) => {
    let t = tracks.get(id);
    if (!t) tracks.set(id, (t = { streak: 0 }));
    return t;
  };

  let xp = 0;
  let grain = 0;
  let level = 1;
  let wellbeing = rules.initialWellbeing;
  let sick = false;
  let daysBelow = 0;
  let goodStreak = 0;
  let happyStreak = 0;
  const days: DayResult[] = [];
  let todayProgress: FarmState['todayProgress'] | null = null;

  const alive = () => farmAnimals.filter((a) => a.diedOn === null);

  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    const closed = d < today;
    const events: FarmEvent[] = [];

    // Animales comprados o iniciales que llegan ese día.
    for (const a of purchases) {
      if (a.acquiredOn !== d) continue;
      farmAnimals.push({ ...pickAnimalFields(a), diedOn: null });
      grain = Math.max(0, grain - a.price);
    }

    const vacation = isVacationDay(vacations, d);
    let earned = 0;
    let penalty = 0;
    let achieved = 0;
    let possible = 0;
    let doneCount = 0;
    let scheduledCount = 0;

    for (const h of habits) {
      const cfg = configOn(h, d);
      if (!cfg || !isActiveOn(h, d)) continue;
      const reward = rules.pointsPerEffort * cfg.effort;
      const fine = rules.pointsPerEffort * (rules.penaltyBase - cfg.effort);
      const inGrace = diffDays(h.startDate, d) < rules.newHabitGraceDays;
      const t = track(h.id);

      if (!isFlexible(cfg.schedule)) {
        if (!isScheduledOn(cfg.schedule, h.startDate, d)) continue;
        const ratio = logRatio(logOf(h.id, d), cfg);
        if (ratio === null) continue; // saltado: neutro
        const weeks = Math.floor(t.streak / 7);
        earned += ratio * reward * streakMultiplier(rules, weeks);
        if (closed && !vacation) penalty += (1 - ratio) * fine;
        if (!inGrace) {
          possible += reward;
          achieved += ratio * reward;
          scheduledCount++;
          if (ratio >= 1) doneCount++;
        }
        if (ratio >= 1) t.streak++;
        else if (closed && !vacation) t.streak = 0;
        continue;
      }

      // Frecuencia flexible: hacerlo suma ese día; lo que falte se penaliza al
      // cerrar el periodo (último día de la semana/mes).
      const ratio = logRatio(logOf(h.id, d), cfg);
      const weeks = cfg.schedule.type === 'timesPerMonth' ? t.streak * 4 : t.streak;
      if (ratio !== null && ratio > 0) {
        earned += ratio * reward * streakMultiplier(rules, weeks);
        if (!inGrace) {
          possible += ratio * reward;
          achieved += ratio * reward;
          scheduledCount++;
          if (ratio >= 1) doneCount++;
        }
      }
      const period = periodOf(cfg.schedule, d);
      const periodEnds = period.end === d || !isActiveOn(h, addDays(d, 1));
      if (closed && periodEnds) {
        let count = 0;
        for (let x = period.start; x <= d; x = addDays(x, 1)) {
          if (x < h.startDate) continue;
          const r = logRatio(logOf(h.id, x), cfg);
          if (r === null || r >= 1) count++;
        }
        const shortfall = Math.max(0, cfg.schedule.times - count);
        if (shortfall > 0 && !vacation) {
          penalty += shortfall * fine;
          if (!inGrace) {
            possible += shortfall * reward;
            scheduledCount += shortfall;
          }
          t.streak = 0;
        } else if (shortfall === 0) {
          t.streak++;
        }
      }
    }

    earned = Math.round(earned);
    penalty = Math.round(penalty);
    const compliance = possible > 0 ? achieved / possible : null;
    xp += earned;
    grain = Math.max(0, grain + earned - penalty);
    const newLevel = levelForXp(xp, rules);
    if (newLevel > level) {
      for (let l = level + 1; l <= newLevel; l++) events.push({ type: 'levelUp', level: l });
      level = newLevel;
    }

    if (!closed) {
      todayProgress = { date: d, earned, penalty, compliance, doneCount, scheduledCount, vacation };
      break;
    }

    // ----- Cierre del día: bienestar, salud, muertes y nacimientos -----
    let delta = 0;
    if (!vacation && compliance !== null) {
      const enoughHabits = doneCount >= Math.min(rules.minHabitsForGoodDay, scheduledCount);
      const goodDay = compliance >= rules.goodDayCompliance && enoughHabits;
      delta = rules.wellbeingBands.find((b) => compliance >= b.minCompliance)?.delta ?? 0;
      if (delta > 0 && !enoughHabits) delta = rules.notEnoughHabitsDelta;
      wellbeing = Math.min(100, Math.max(0, wellbeing + delta));
      goodStreak = goodDay ? goodStreak + 1 : 0;
    }

    if (!vacation) {
      if (wellbeing < rules.sickBelow) {
        daysBelow++;
        if (!sick && alive().length > 0) events.push({ type: 'sick' });
        sick = true;
      } else {
        daysBelow = 0;
        if (sick && goodStreak >= rules.healGoodDays) {
          sick = false;
          events.push({ type: 'healed' });
        }
      }

      if (daysBelow >= rules.deathAfterDaysBelow) {
        const victim = pick(alive(), `death|${d}`);
        if (victim) {
          victim.diedOn = d;
          events.push({ type: 'death', animalId: victim.id });
        }
        daysBelow = 0;
      }

      happyStreak = wellbeing >= rules.happyAbove && !sick ? happyStreak + 1 : 0;
      if (happyStreak >= rules.birthEveryHappyDays) {
        happyStreak = 0;
        const living = alive();
        const parent = pick(living, `birth|${d}`);
        if (parent && living.length < rules.capacity(level)) {
          const id = deterministicId('birth', parent.id, d);
          farmAnimals.push({
            id,
            name:
              namesById.get(id) ?? DEFAULT_ANIMAL_NAMES[hash(id) % DEFAULT_ANIMAL_NAMES.length]!,
            species: parent.species,
            acquiredOn: d,
            source: 'born',
            diedOn: null,
          });
          events.push({ type: 'birth', animalId: id });
        }
      }
    }

    days.push({
      date: d,
      earned,
      penalty,
      compliance,
      doneCount,
      scheduledCount,
      vacation,
      wellbeingDelta: delta,
      wellbeing,
      events,
    });
  }

  let deathWarning: FarmState['deathWarning'] = null;
  if (sick && daysBelow > 0) {
    const victim = pick(
      alive(),
      `death|${addDays(today, rules.deathAfterDaysBelow - daysBelow - 1)}`,
    );
    if (victim) {
      deathWarning = {
        animalId: victim.id,
        name: victim.name,
        daysLeft: rules.deathAfterDaysBelow - daysBelow,
      };
    }
  }

  return {
    today,
    xp,
    level,
    grain,
    wellbeing,
    sick,
    daysBelowThreshold: daysBelow,
    goodStreak,
    animals: farmAnimals,
    deathWarning,
    days,
    todayProgress: todayProgress ?? {
      date: today,
      earned: 0,
      penalty: 0,
      compliance: null,
      doneCount: 0,
      scheduledCount: 0,
      vacation: isVacationDay(vacations, today),
    },
  };
}

function pickAnimalFields(a: Animal): Omit<FarmAnimal, 'diedOn'> {
  return {
    id: a.id,
    name: a.name,
    species: a.species,
    acquiredOn: a.acquiredOn,
    source: a.source,
  };
}
