import { habitStreak } from '../domain/habits';
import type { Habit, HabitLog, Task, TaskCompletion } from '../model/types';
import type { FarmState } from './engine';

// Logros: se calculan a partir de los datos (como la granja), así no hay que
// guardarlos ni sincronizarlos.

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** 0–1: cuánto falta. 1 = conseguido. */
  progress: number;
  unlocked: boolean;
}

export interface AchievementInput {
  farm: FarmState;
  habits: Habit[];
  logs: HabitLog[];
  tasks: Task[];
  taskCompletions: TaskCompletion[];
}

function achievement(
  id: string,
  icon: string,
  title: string,
  description: string,
  current: number,
  goal: number,
): Achievement {
  const progress = Math.min(1, Math.max(0, current / goal));
  return { id, icon, title, description, progress, unlocked: progress >= 1 };
}

/** Racha más larga de días cerrados seguidos con un cumplimiento ≥ min. */
function bestRunOfDays(farm: FarmState, min: number): number {
  let best = 0;
  let run = 0;
  for (const d of farm.days) {
    if (d.vacation || d.compliance === null) continue;
    run = d.compliance >= min ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function computeAchievements(input: AchievementInput): Achievement[] {
  const { farm } = input;
  const today = farm.today;
  const doneLogs = input.logs.filter((l) => l.deletedAt === null && l.status === 'done').length;
  const bestStreak = Math.max(
    0,
    ...input.habits
      .filter((h) => h.deletedAt === null)
      .map((h) => habitStreak(h, input.logs, today).best),
  );
  const alive = farm.animals.filter((a) => a.diedOn === null).length;
  const events = farm.days.flatMap((d) => d.events);
  const tasksDone =
    input.tasks.filter((t) => t.deletedAt === null && t.status === 'done').length +
    input.taskCompletions.filter((c) => c.deletedAt === null).length;

  return [
    achievement(
      'primer-paso',
      '🌱',
      'Primer paso',
      'Completa un hábito por primera vez',
      doneLogs,
      1,
    ),
    achievement(
      'constancia',
      '🔥',
      'Constancia',
      'Consigue una racha de 7 en un hábito',
      bestStreak,
      7,
    ),
    achievement('un-mes', '📅', 'Un mes entero', 'Racha de 30 en un hábito', bestStreak, 30),
    achievement('centenario', '💯', 'Centenario', 'Racha de 100 en un hábito', bestStreak, 100),
    achievement(
      'semana-perfecta',
      '⭐',
      'Semana perfecta',
      '7 días seguidos cumpliendo el 90 % o más',
      bestRunOfDays(farm, 0.9),
      7,
    ),
    achievement(
      'primera-cria',
      '🐣',
      'Primera cría',
      'Que nazca un animal en tu granja',
      events.filter((e) => e.type === 'birth').length,
      1,
    ),
    achievement(
      'enfermero',
      '💊',
      'Enfermero',
      'Cura a tus animales después de que enfermen',
      events.filter((e) => e.type === 'healed').length,
      1,
    ),
    achievement('granja-viva', '🏡', 'Granja viva', 'Ten 5 animales vivos a la vez', alive, 5),
    achievement('nivel-5', '🌾', 'Granjero experto', 'Llega al nivel 5', farm.level, 5),
    achievement('nivel-10', '🏆', 'Leyenda del campo', 'Llega al nivel 10', farm.level, 10),
    achievement('productivo', '✅', 'Productivo', 'Completa 50 tareas', tasksDone, 50),
    achievement(
      'mil-hechos',
      '🎯',
      'Mil veces sí',
      'Marca 1000 hábitos como hechos',
      doneLogs,
      1000,
    ),
  ];
}
