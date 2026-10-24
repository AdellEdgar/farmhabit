import type { Species } from '../model/types';

// TODOS los números del juego viven aquí, para poder equilibrarlo sin tocar
// la lógica del motor. Si cambias algo, revisa CLAUDE.md ("Reglas del juego").

export interface WellbeingBand {
  /** Cumplimiento mínimo del día (0–1) para aplicar esta banda. */
  minCompliance: number;
  delta: number;
}

export interface GameRules {
  /** Puntos por hacer un hábito: pointsPerEffort × esfuerzo. */
  pointsPerEffort: number;
  /** Penalización por no hacerlo: pointsPerEffort × (penaltyBase − esfuerzo). */
  penaltyBase: number;
  /** Bonus por cada semana de racha (0.05 = +5 %). */
  streakBonusPerWeek: number;
  streakBonusMax: number;

  initialWellbeing: number;
  /** Bandas de cumplimiento → variación de bienestar, de mayor a menor. */
  wellbeingBands: WellbeingBand[];
  /** Cumplimiento a partir del cual un día es "bueno". */
  goodDayCompliance: number;
  /** Hábitos hechos necesarios para que un día bueno sume (o todos, si tocan menos). */
  minHabitsForGoodDay: number;
  /** Variación si el cumplimiento es alto pero no se llegó al mínimo de hábitos. */
  notEnoughHabitsDelta: number;

  /** Por debajo de este bienestar los animales enferman. */
  sickBelow: number;
  /** Días seguidos por debajo de sickBelow para que muera un animal. */
  deathAfterDaysBelow: number;
  /** Días buenos seguidos necesarios para curarse. */
  healGoodDays: number;
  /** Los hábitos más nuevos que esto no cuentan para recuperar bienestar. */
  newHabitGraceDays: number;

  /** Bienestar a partir del cual los animales están contentos. */
  happyAbove: number;
  /** Días seguidos contentos para que nazca una cría. */
  birthEveryHappyDays: number;

  /** XP acumulada necesaria para alcanzar cada nivel. */
  xpForLevel(level: number): number;
  /** Animales vivos máximos según el nivel. */
  capacity(level: number): number;
  speciesUnlockLevel: Record<Species, number>;
  speciesPrice: Record<Species, number>;
}

export const DEFAULT_RULES: GameRules = {
  pointsPerEffort: 10,
  penaltyBase: 6,
  streakBonusPerWeek: 0.05,
  streakBonusMax: 0.5,

  initialWellbeing: 80,
  wellbeingBands: [
    { minCompliance: 0.9, delta: 12 },
    { minCompliance: 0.7, delta: 8 },
    { minCompliance: 0.4, delta: -5 },
    { minCompliance: 0, delta: -15 },
  ],
  goodDayCompliance: 0.7,
  minHabitsForGoodDay: 3,
  notEnoughHabitsDelta: -5,

  sickBelow: 30,
  deathAfterDaysBelow: 3,
  healGoodDays: 2,
  newHabitGraceDays: 7,

  happyAbove: 70,
  birthEveryHappyDays: 7,

  // Nivel 1 = 0 XP, nivel 2 = 200, nivel 3 = 600, nivel 4 = 1200…
  xpForLevel: (level) => 100 * level * (level - 1),
  capacity: (level) => 4 + 2 * level,
  speciesUnlockLevel: { chicken: 1, rabbit: 2, sheep: 3, pig: 5, cow: 7, horse: 10 },
  speciesPrice: { chicken: 50, rabbit: 80, sheep: 150, pig: 250, cow: 400, horse: 700 },
};

export function levelForXp(xp: number, rules: GameRules = DEFAULT_RULES): number {
  let level = 1;
  while (rules.xpForLevel(level + 1) <= xp) level++;
  return level;
}

/** Nombres por defecto para crías sin nombre. */
export const DEFAULT_ANIMAL_NAMES = [
  'Lola',
  'Copito',
  'Canela',
  'Pipo',
  'Nube',
  'Trufa',
  'Bimba',
  'Rufo',
  'Luna',
  'Tango',
  'Kiwi',
  'Mora',
  'Chispa',
  'Pancho',
  'Greta',
  'Coco',
];
