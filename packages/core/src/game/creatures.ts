import {
  configOn,
  isActiveOn,
  isFlexible,
  isScheduledOn,
  logRatio,
  periodOf,
} from '../domain/habits';
import type {
  Habit,
  HabitConfig,
  HabitLog,
  Purchase,
  Task,
  TaskCompletion,
  Vacation,
} from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, diffDays, localDateOf, startOfWeek } from '../util/dates';
import { compareSortKey } from '../util/fractional-index';
import {
  DEFAULT_CREATURE_RULES,
  nextStage,
  trainerLevel,
  unlockedSpecies,
  type CreatureRules,
  type Mood,
  type Stage,
} from './creature-rules';
import { defaultSpecies, SPECIES, speciesById, type SpeciesId } from './species';
import { ACHIEVEMENTS, type AchievementContext } from './creature-achievements';
import { emptyWeek, selectMissions, weekHasData, type Mission, type WeekStats } from './missions';
import { isVacationDay } from './vacations';

// Motor de las criaturas. El estado NO se guarda: se recalcula día a día desde
// el historial, así todos los dispositivos ven lo mismo y no se puede trucar.
// Los días anteriores a hoy están cerrados; hoy es provisional: suma lo hecho
// pero no resta ni hace retroceder.

export interface GameInput {
  /** Todos los hábitos y tareas, también archivados y borrados (lo ganado no se pierde). */
  habits: Habit[];
  logs: HabitLog[];
  tasks: Task[];
  taskCompletions: TaskCompletion[];
  purchases: Purchase[];
  vacations: Vacation[];
  today: LocalDate;
  rules?: CreatureRules;
}

export interface CreatureEvent {
  date: LocalDate;
  type: 'hatch' | 'evolve' | 'demote';
  stage: Stage;
}

export interface Creature {
  habitId: string;
  species: SpeciesId;
  name: string;
  xp: number;
  stage: Stage;
  mood: Mood;
  /** Días (frecuencia fija) o periodos (flexible) seguidos. */
  streak: number;
  history: CreatureEvent[];
  /** XP ganada hoy. */
  xpToday: number;
  archived: boolean;
  background: string | null;
  aura: string | null;
  maxStageEver: Stage;
}

export interface GameAchievement {
  id: string;
  title: string;
  description: string;
  reward: number;
  unlockedOn: LocalDate | null;
}

export interface GameState {
  today: LocalDate;
  /** Sin los hábitos borrados, en el orden de la lista de hábitos. */
  creatures: Creature[];
  trainerXp: number;
  level: number;
  unlockedSpecies: SpeciesId[];
  pesetas: number;
  /** Comodines guardados. */
  freezes: number;
  frozenDays: LocalDate[];
  /** Fondos y auras comprados ("background:playa", "aura:dorada"). */
  owned: string[];
  achievements: GameAchievement[];
  /** Etapas (1–4) que se han visto de cada especie. */
  seenStages: Record<SpeciesId, Stage[]>;
  /** XP ganada cada día por todas las criaturas. */
  dailyXp: Record<LocalDate, number>;
  /** Criaturas que retrocederían si hoy se cierra sin hacer su hábito. */
  alerts: { habitId: string; name: string }[];
  /** Misiones de la semana de hoy (vacío antes de `missionsStart`). */
  missions: Mission[];
  /** Estadísticas por semana, por su lunes. Las semanas sin datos no aparecen. */
  weeks: Record<LocalDate, WeekStats>;
}

interface Track {
  habit: Habit;
  species: SpeciesId;
  xp: number;
  stage: Stage;
  maxStage: Stage;
  streak: number;
  history: CreatureEvent[];
  /** Cumplimiento (0–1) de los últimos días cerrados que contaban, para el ánimo. */
  samples: number[];
  xpToday: number;
  /** XP que perdería si hoy se cierra sin hacerlo. */
  riskToday: number;
  /** Racha en días, para los logros (las flexibles cuentan 7 o 30 por periodo). */
  streakDays: number;
  /** XP ganada esta semana, para elegir la criatura estrella. */
  weekXp: number;
}

/** Lo que un hábito aporta un día, antes de aplicarlo. */
interface Outcome {
  track: Track;
  gain: number;
  pesetas: number;
  penalty: number;
  /** Racha si el día cuenta como fallado y si no. */
  streakIfMissed: number;
  streakIfKept: number;
  /** Días que vale cada unidad de racha (1, o 7 / 30 en las flexibles). */
  streakUnitDays: number;
  samples: number[];
  /** Hecho del todo ese día. */
  done: boolean;
  /** Contaba como programado ese día (en las flexibles, solo si se hizo). */
  expected: boolean;
  /** Veces que faltaron al cerrar el periodo de una flexible. */
  shortfall: number;
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function earnedXp(
  rules: CreatureRules,
  cfg: HabitConfig,
  ratio: number,
  streakWeeks: number,
): number {
  const bonus = 1 + Math.min(rules.streakBonusMax, rules.streakBonusPerWeek * streakWeeks);
  return Math.round(ratio * (rules.xpBase + rules.xpPerEffort * cfg.effort) * bonus);
}

/** XP que da hacer un hábito (entero o una parte) con la racha que lleva, bonus incluido. */
export function habitXpGain(
  cfg: HabitConfig,
  streak: number,
  ratio = 1,
  rules: CreatureRules = DEFAULT_CREATURE_RULES,
): number {
  const weeks = !isFlexible(cfg.schedule)
    ? Math.floor(streak / 7)
    : cfg.schedule.type === 'timesPerMonth'
      ? streak * 4
      : streak;
  return earnedXp(rules, cfg, ratio, weeks);
}

function missedXp(rules: CreatureRules, cfg: HabitConfig, missing: number): number {
  return Math.round(missing * rules.penaltyPerMissingEffort * (rules.penaltyBase - cfg.effort));
}

function moodOf(rules: CreatureRules, samples: number[]): Mood {
  const recent = samples.slice(-rules.moodWindow);
  if (recent.length < rules.moodMinDays) return 'normal';
  const rate = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (rate >= rules.moodBands.feliz) return 'feliz';
  if (rate >= rules.moodBands.normal) return 'normal';
  if (rate >= rules.moodBands.cansada) return 'cansada';
  return 'triste';
}

/**
 * Veces que faltan para el objetivo de un hábito flexible al llegar a `d`. Si
 * no existía todo el periodo (empezó a mitad, o se archivó), se exige la parte
 * proporcional del objetivo.
 */
function periodShortfall(
  h: Habit,
  cfg: HabitConfig,
  d: LocalDate,
  logOf: (habitId: string, date: LocalDate) => HabitLog | undefined,
): number {
  if (!isFlexible(cfg.schedule)) return 0;
  const period = periodOf(cfg.schedule, d);
  let count = 0;
  let activeDays = 0;
  for (let x = period.start; x <= d; x = addDays(x, 1)) {
    if (!isActiveOn(h, x)) continue;
    activeDays++;
    const r = logRatio(logOf(h.id, x), cfg);
    if (r === null || r >= 1) count++;
  }
  const periodDays = diffDays(period.start, period.end) + 1;
  return Math.max(0, Math.ceil((cfg.schedule.times * activeDays) / periodDays) - count);
}

/** Lo que aporta un hábito el día `d` (null si ese día no cuenta para él). */
function outcomeOf(
  rules: CreatureRules,
  t: Track,
  d: LocalDate,
  closed: boolean,
  logOf: (habitId: string, date: LocalDate) => HabitLog | undefined,
): Outcome | null {
  const h = t.habit;
  const cfg = configOn(h, d);
  if (!cfg || !isActiveOn(h, d)) return null;

  if (!isFlexible(cfg.schedule)) {
    if (!isScheduledOn(cfg.schedule, h.startDate, d)) return null;
    const ratio = logRatio(logOf(h.id, d), cfg);
    if (ratio === null) return null; // saltado: neutro
    if (!closed) t.riskToday = missedXp(rules, cfg, 1 - ratio);
    const done = ratio >= 1;
    return {
      track: t,
      gain: habitXpGain(cfg, t.streak, ratio, rules),
      pesetas: Math.round(ratio * cfg.effort * rules.pesetasPerEffort),
      penalty: closed ? missedXp(rules, cfg, 1 - ratio) : 0,
      streakIfMissed: done ? t.streak + 1 : closed ? 0 : t.streak,
      streakIfKept: done ? t.streak + 1 : t.streak,
      streakUnitDays: 1,
      samples: closed ? [ratio] : [],
      done,
      expected: true,
      shortfall: 0,
    };
  }

  // Frecuencia flexible: hacerlo suma ese día; lo que falte del objetivo resta
  // al cerrar el periodo (último día de la semana o del mes).
  const ratio = logRatio(logOf(h.id, d), cfg);
  const out: Outcome = {
    track: t,
    gain: ratio !== null && ratio > 0 ? habitXpGain(cfg, t.streak, ratio, rules) : 0,
    pesetas:
      ratio !== null && ratio > 0 ? Math.round(ratio * cfg.effort * rules.pesetasPerEffort) : 0,
    penalty: 0,
    streakIfMissed: t.streak,
    streakIfKept: t.streak,
    streakUnitDays: cfg.schedule.type === 'timesPerMonth' ? 30 : 7,
    samples: closed && ratio !== null && ratio > 0 ? [ratio] : [],
    done: ratio !== null && ratio >= 1,
    expected: ratio !== null && ratio >= 1,
    shortfall: 0,
  };
  const period = periodOf(cfg.schedule, d);
  const periodEnds = period.end === d || !isActiveOn(h, addDays(d, 1));
  if (!closed) {
    // Solo se arriesga algo el día que se cierra el periodo, y si aún no lo ha hecho hoy.
    const undone = ratio !== null && ratio < 1;
    t.riskToday =
      periodEnds && undone ? missedXp(rules, cfg, periodShortfall(h, cfg, d, logOf)) : 0;
  }
  if (closed && periodEnds) {
    const shortfall = periodShortfall(h, cfg, d, logOf);
    if (shortfall > 0) {
      out.penalty = missedXp(rules, cfg, shortfall);
      out.streakIfMissed = 0;
      out.samples.push(...Array<number>(shortfall).fill(0));
      out.shortfall = shortfall;
    } else {
      out.streakIfMissed = out.streakIfKept = t.streak + 1;
    }
  }
  return out;
}

/**
 * Prioridades de las tareas completadas cada día que dan pesetas: creadas un día
 * antes o más y no borradas ese mismo día (borrar después, p. ej. "vaciar
 * completadas", no quita lo ganado).
 */
function taskCompletionDays(
  tasks: Task[],
  completions: TaskCompletion[],
  today: LocalDate,
): Map<LocalDate, (1 | 2 | 3)[]> {
  const out = new Map<LocalDate, (1 | 2 | 3)[]>();
  const add = (task: Task, completedAt: number) => {
    const day = localDateOf(completedAt);
    if (day <= localDateOf(task.createdAt) || day > today) return;
    if (task.deletedAt !== null && localDateOf(task.deletedAt) <= day) return;
    const list = out.get(day);
    if (list) list.push(task.priority);
    else out.set(day, [task.priority]);
  };
  const byTask = new Map(tasks.map((t) => [t.id, t]));
  for (const t of [...tasks].sort(byId))
    if (t.status === 'done' && t.completedAt !== null) add(t, t.completedAt);
  for (const c of [...completions].sort(byId)) {
    const task = byTask.get(c.taskId);
    if (task && c.deletedAt === null) add(task, c.completedAt);
  }
  return out;
}

function stageEvents(t: Track, date: LocalDate, from: Stage, to: Stage): void {
  for (let s = from + 1; s <= to; s++)
    t.history.push({ date, type: s === 1 ? 'hatch' : 'evolve', stage: s as Stage });
  if (to < from) t.history.push({ date, type: 'demote', stage: to });
}

export function computeGame(input: GameInput): GameState {
  const rules = input.rules ?? DEFAULT_CREATURE_RULES;
  const { today } = input;
  const habits = [...input.habits].sort(byId);
  const logIndex = new Map<string, HabitLog>();
  for (const l of [...input.logs].sort(byId)) logIndex.set(`${l.habitId}|${l.date}`, l);
  const logOf = (habitId: string, date: LocalDate) => logIndex.get(`${habitId}|${date}`);
  const vacations = [...input.vacations].sort(byId);

  const tracks: Track[] = habits.map((habit) => ({
    habit,
    species: speciesById(habit.creatureSpecies ?? '')?.id ?? defaultSpecies(habit.id),
    xp: 0,
    stage: 0,
    maxStage: 0,
    streak: 0,
    history: [],
    samples: [],
    xpToday: 0,
    riskToday: 0,
    streakDays: 0,
    weekXp: 0,
  }));
  const purchases = [...input.purchases].filter((p) => p.deletedAt === null).sort(byId);
  const taskDays = taskCompletionDays(input.tasks, input.taskCompletions, today);
  const starts = [
    ...habits.map((h) => h.startDate),
    ...purchases.map((p) => p.date),
    ...taskDays.keys(),
  ].filter((d) => d <= today);
  const firstDay = starts.length > 0 ? starts.reduce((a, b) => (b < a ? b : a)) : null;

  let trainerXp = 0;
  // Saldo interno: puede ser negativo (compras sin saldo real, por deshacer lo
  // marcado hoy o por comprar desde dos dispositivos): se paga con lo que se gane.
  let pesetas = 0;
  let freezes = 0;
  let tasksDone = 0;
  const frozenDays: LocalDate[] = [];
  const owned = new Set<string>();
  const dailyXp: Record<LocalDate, number> = {};
  const unlockedOn = new Map<string, LocalDate>();
  const weeks: Record<LocalDate, WeekStats> = {};
  let week = emptyWeek('');
  let missions: Mission[] = [];
  const startWeek = (monday: LocalDate): Mission[] => {
    if (monday < rules.missionsStart) return [];
    const prev = weeks[addDays(monday, -7)];
    return selectMissions({
      week: monday,
      habits,
      prevTasksDone: prev?.tasksDone ?? 0,
      prevXp: prev?.xp ?? 0,
      rules,
    }).map((m) => ({ ...m, progress: 0, doneOn: null }));
  };

  for (let d = firstDay ?? today; firstDay !== null && d <= today; d = addDays(d, 1)) {
    const closed = d < today;
    const monday = startOfWeek(d);
    if (monday !== week.week) {
      week = emptyWeek(monday);
      missions = startWeek(monday);
      for (const t of tracks) t.weekXp = 0;
    }
    const pesetasBefore = pesetas;
    let dayExpected = 0;
    let dayDone = 0;
    const vacation = isVacationDay(vacations, d);
    const outcomes = tracks
      .map((t) => outcomeOf(rules, t, d, closed, logOf))
      .filter((o): o is Outcome => o !== null);

    // Comodín: un día cerrado con algún fallo, si hay uno guardado de antes.
    const frozen = closed && !vacation && freezes > 0 && outcomes.some((o) => o.penalty > 0);
    if (frozen) {
      freezes--;
      frozenDays.push(d);
    }

    let gained = 0;
    for (const o of outcomes) {
      const t = o.track;
      // Vacaciones o comodín: ese día no resta, no rompe rachas ni cuenta para el ánimo.
      const neutral = vacation || frozen;
      const penalty = neutral ? 0 : o.penalty;
      t.streak = neutral ? o.streakIfKept : o.streakIfMissed;
      t.streakDays = t.streak * o.streakUnitDays;
      if (!neutral) t.samples.push(...o.samples);
      t.xp = Math.max(0, t.xp + o.gain - penalty);
      gained += o.gain;
      pesetas += o.pesetas;
      if (!closed) t.xpToday = o.gain;
      t.weekXp += o.gain;
      week.bestStreak = Math.max(week.bestStreak, t.streakDays);
      // Un día protegido sin hacer no contaba como programado.
      if (o.expected && (o.done || !neutral)) {
        dayExpected++;
        if (o.done) dayDone++;
      }
      if (!neutral) week.scheduled += o.shortfall;
      for (const m of missions) if (o.done && m.habitId === t.habit.id) m.progress++;

      const before = t.stage;
      const next = nextStage(t.xp, before, rules);
      // Hoy solo se sube: bajar se decide al cerrar el día.
      t.stage = closed ? next : (Math.max(before, next) as Stage);
      if (t.stage !== before) {
        const seenEvents = t.history.length;
        stageEvents(t, d, before, t.stage);
        for (const e of t.history.slice(seenEvents)) {
          if (e.type === 'hatch') week.hatched++;
          else if (e.type === 'evolve') week.evolved++;
          else week.demoted++;
        }
      }
      t.maxStage = Math.max(t.maxStage, t.stage) as Stage;
    }
    trainerXp += gained;
    if (gained > 0) dailyXp[d] = gained;
    week.xp += gained;
    week.scheduled += dayExpected;
    week.done += dayDone;
    if (dayExpected > 0 && dayDone === dayExpected) week.perfectDays++;

    // Tareas completadas ese día, con tope diario.
    const tasks = taskDays.get(d) ?? [];
    tasksDone += tasks.length;
    const taskPesetas = tasks.reduce((sum, priority) => sum + rules.taskPesetas[priority], 0);
    pesetas += Math.min(rules.taskPesetasDailyCap, taskPesetas);
    week.tasksDone += tasks.length;

    // Misiones: el premio se abona el día que se cumplen, antes de los logros.
    for (const m of missions) {
      if (m.kind === 'tasks') m.progress = week.tasksDone;
      else if (m.kind === 'perfect') m.progress = week.perfectDays;
      else if (m.kind === 'xp') m.progress = week.xp;
      if (m.doneOn === null && m.progress >= m.target) {
        m.doneOn = d;
        pesetas += m.reward;
        week.missionsDone++;
      }
    }

    // Logros que se cumplen hoy por primera vez.
    const seen = new Set(tracks.filter((t) => t.maxStage >= 1).map((t) => t.species));
    const context: AchievementContext = {
      maxStages: tracks.map((t) => t.maxStage),
      bestStreakDays: Math.max(0, ...tracks.map((t) => t.streakDays)),
      tasksDone,
      speciesSeen: seen.size,
      pesetas,
    };
    for (const a of ACHIEVEMENTS) {
      if (unlockedOn.has(a.id) || !a.check(context)) continue;
      unlockedOn.set(a.id, d);
      pesetas += a.reward;
    }

    week.pesetas += pesetas - pesetasBefore;
    let top: Track | null = null;
    for (const t of tracks) if (t.weekXp > 0 && (!top || t.weekXp > top.weekXp)) top = t;
    week.topHabitId = top?.habit.id ?? null;
    if (weekHasData(week)) weeks[monday] = week;

    // Compras del día: restan después de lo ganado ese día; un comodín sirve
    // desde el día siguiente.
    for (const p of purchases) {
      if (p.date !== d) continue;
      pesetas -= p.price;
      if (p.item === 'freeze') freezes = Math.min(rules.freezeMax, freezes + 1);
      else owned.add(p.item);
    }
  }

  // Sin ningún dato el bucle no corre, pero ya hay misiones de tareas.
  if (firstDay === null) missions = startWeek(startOfWeek(today));
  for (const m of missions) m.progress = Math.min(m.progress, m.target);

  const level = trainerLevel(trainerXp);
  const seenStages = Object.fromEntries(SPECIES.map((s) => [s.id, [] as Stage[]])) as Record<
    SpeciesId,
    Stage[]
  >;
  const creatures: Creature[] = [];
  const alerts: GameState['alerts'] = [];
  for (const t of [...tracks].sort((a, b) => compareSortKey(a.habit, b.habit))) {
    const h = t.habit;
    const species = t.species;
    const reached = [{ species: species as string, maxStage: t.maxStage }, ...h.creaturePast];
    for (const r of reached) {
      const known = speciesById(r.species)?.id; // puede ser de una versión más nueva
      if (!known) continue;
      for (let s = 1; s <= r.maxStage; s++)
        if (!seenStages[known].includes(s as Stage)) seenStages[known].push(s as Stage);
    }
    if (h.deletedAt !== null) continue;
    const name = h.creatureName || speciesById(species)!.name;
    const mood = moodOf(rules, t.samples);
    const archived = h.archivedAt !== null;
    creatures.push({
      habitId: h.id,
      species,
      name,
      xp: t.xp,
      stage: t.stage,
      mood,
      streak: t.streak,
      history: t.history,
      xpToday: t.xpToday,
      archived,
      background: h.creatureBackground,
      aura: h.creatureAura,
      maxStageEver: t.maxStage,
    });
    const wouldDemote =
      t.stage > 0 &&
      t.riskToday > 0 &&
      t.xp - t.riskToday < rules.demoteRatio * rules.stageXp[t.stage]!;
    if (!archived && wouldDemote && freezes === 0 && !isVacationDay(vacations, today))
      alerts.push({ habitId: h.id, name });
  }
  for (const list of Object.values(seenStages)) list.sort();

  return {
    today,
    creatures,
    trainerXp,
    level,
    unlockedSpecies: unlockedSpecies(level),
    pesetas: Math.max(0, pesetas),
    freezes,
    frozenDays,
    owned: [...owned].sort(),
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      reward: a.reward,
      unlockedOn: unlockedOn.get(a.id) ?? null,
    })),
    seenStages,
    dailyXp,
    alerts,
    missions,
    weeks,
  };
}
