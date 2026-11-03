import type { Stage } from './creature-rules';

// Logros de las criaturas. Se calculan día a día en el motor (no se guardan):
// el día que se cumple la condición quedan conseguidos y dan su premio.

export interface AchievementContext {
  /** Etapa máxima alcanzada alguna vez por cada criatura. */
  maxStages: Stage[];
  /** Racha más larga en curso, en días. */
  bestStreakDays: number;
  /** Tareas completadas que cuentan (creadas un día antes o más). */
  tasksDone: number;
  /** Especies que han eclosionado alguna vez. */
  speciesSeen: number;
  pesetas: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  reward: number;
  check: (c: AchievementContext) => boolean;
}

const reached = (c: AchievementContext, stage: Stage) => c.maxStages.some((s) => s >= stage);

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'primera-eclosion',
    title: '¡Ha nacido!',
    description: 'Una criatura sale del huevo',
    reward: 20,
    check: (c) => reached(c, 1),
  },
  {
    id: 'primer-joven',
    title: 'Creciendo',
    description: 'Una criatura llega a joven',
    reward: 30,
    check: (c) => reached(c, 2),
  },
  {
    id: 'primer-adulto',
    title: 'Hecha y derecha',
    description: 'Una criatura llega a adulta',
    reward: 50,
    check: (c) => reached(c, 3),
  },
  {
    id: 'primera-leyenda',
    title: 'Leyenda',
    description: 'Una criatura llega a leyenda',
    reward: 100,
    check: (c) => reached(c, 4),
  },
  {
    id: 'tres-leyendas',
    title: 'Panteón',
    description: 'Tres criaturas llegan a leyenda',
    reward: 200,
    check: (c) => c.maxStages.filter((s) => s >= 4).length >= 3,
  },
  {
    id: 'racha-7',
    title: 'Una semana',
    description: 'Racha de 7 días en un hábito',
    reward: 20,
    check: (c) => c.bestStreakDays >= 7,
  },
  {
    id: 'racha-30',
    title: 'Un mes',
    description: 'Racha de 30 días en un hábito',
    reward: 60,
    check: (c) => c.bestStreakDays >= 30,
  },
  {
    id: 'racha-100',
    title: 'Imparable',
    description: 'Racha de 100 días en un hábito',
    reward: 200,
    check: (c) => c.bestStreakDays >= 100,
  },
  {
    id: 'tareas-10',
    title: 'A chambear',
    description: 'Completa 10 tareas',
    reward: 20,
    check: (c) => c.tasksDone >= 10,
  },
  {
    id: 'tareas-100',
    title: 'Máquina',
    description: 'Completa 100 tareas',
    reward: 100,
    check: (c) => c.tasksDone >= 100,
  },
  {
    id: 'coleccion-completa',
    title: 'Coleccionista',
    description: 'Haz eclosionar las 16 especies',
    reward: 300,
    check: (c) => c.speciesSeen >= 16,
  },
  {
    id: 'ahorrador',
    title: 'Ahorrador',
    description: 'Ten 500 pesetas a la vez',
    reward: 50,
    check: (c) => c.pesetas >= 500,
  },
];
