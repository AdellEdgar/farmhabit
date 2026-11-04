import { configOn, isActiveOn, isFlexible, isScheduledOn } from '../domain/habits';
import type { Habit, HabitConfig } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays } from '../util/dates';
import { fnv1a } from '../util/hash';
import type { CreatureRules } from './creature-rules';

// Misiones semanales: se eligen de forma determinista con un hash de la semana
// y los hábitos que ya existían ese lunes. No se guardan: las calcula el motor.

export type MissionKind = 'habit' | 'tasks' | 'perfect' | 'xp';

export interface Mission {
  id: string;
  /** Lunes de la semana. */
  week: LocalDate;
  kind: MissionKind;
  habitId: string | null;
  target: number;
  progress: number;
  reward: number;
  doneOn: LocalDate | null;
}

export interface WeekStats {
  week: LocalDate;
  xp: number;
  /** Veces programadas y veces hechas de todos los hábitos. */
  scheduled: number;
  done: number;
  tasksDone: number;
  /** Mejor racha de la semana, en días. */
  bestStreak: number;
  hatched: number;
  evolved: number;
  demoted: number;
  missionsDone: number;
  perfectDays: number;
  topHabitId: string | null;
}

export type NewMission = Omit<Mission, 'progress' | 'doneOn'>;

export interface MissionInput {
  week: LocalDate;
  habits: Habit[];
  prevTasksDone: number;
  prevXp: number;
  rules: CreatureRules;
}

/** Veces que hay que hacer un hábito esa semana con su configuración de ese lunes. */
function scheduledTimes(h: Habit, cfg: HabitConfig, week: LocalDate): number {
  if (isFlexible(cfg.schedule)) {
    return cfg.schedule.type === 'timesPerWeek'
      ? cfg.schedule.times
      : Math.ceil(cfg.schedule.times / 4);
  }
  let times = 0;
  for (let i = 0; i < 7; i++)
    if (isScheduledOn(cfg.schedule, h.startDate, addDays(week, i))) times++;
  return times;
}

export function selectMissions(input: MissionInput): NewMission[] {
  const { week, habits, prevTasksDone, prevXp, rules } = input;
  const rewards = rules.missionRewards;
  const tasksTarget = Math.min(
    rules.missionTasksMax,
    Math.max(rules.missionTasksMin, prevTasksDone),
  );

  // La elegibilidad se mira con el estado de ese lunes, así archivar o borrar
  // un hábito a mitad de semana no cambia las misiones.
  let chosen: { habit: Habit; target: number; hash: number } | null = null;
  for (const habit of habits) {
    if (habit.startDate >= week || !isActiveOn(habit, week)) continue;
    const cfg = configOn(habit, week);
    const target = cfg ? scheduledTimes(habit, cfg, week) : 0;
    if (target === 0) continue;
    const hash = fnv1a(`${week}|${habit.id}`);
    if (!chosen || hash < chosen.hash || (hash === chosen.hash && habit.id < chosen.habit.id))
      chosen = { habit, target, hash };
  }

  const mission = (
    n: number,
    kind: MissionKind,
    target: number,
    habitId: string | null = null,
  ): NewMission => ({
    id: `${week}|${kind}|${n}`,
    week,
    kind,
    habitId,
    target,
    reward: rewards[kind],
  });

  if (!chosen) {
    const step = rules.missionTasksMin;
    return [0, 1, 2].map((n) => mission(n, 'tasks', tasksTarget + n * step));
  }
  const third =
    fnv1a(week) % 2 === 0
      ? mission(2, 'perfect', rules.missionPerfectDays)
      : mission(
          2,
          'xp',
          Math.max(rules.missionXpMin, Math.round((prevXp * rules.missionXpFactor) / 10) * 10),
        );
  return [
    mission(0, 'habit', chosen.target, chosen.habit.id),
    mission(1, 'tasks', tasksTarget),
    third,
  ];
}

/** Estadísticas vacías de una semana. */
export function emptyWeek(week: LocalDate): WeekStats {
  return {
    week,
    xp: 0,
    scheduled: 0,
    done: 0,
    tasksDone: 0,
    bestStreak: 0,
    hatched: 0,
    evolved: 0,
    demoted: 0,
    missionsDone: 0,
    perfectDays: 0,
    topHabitId: null,
  };
}

/** ¿Pasó algo esa semana? Si no, no se guarda. */
export function weekHasData(w: WeekStats): boolean {
  return w.scheduled > 0 || w.xp > 0 || w.tasksDone > 0;
}
