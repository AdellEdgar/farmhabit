// Todos los números del juego de las criaturas, en un solo sitio para poder
// ajustarlos sin tocar la lógica (ver CLAUDE.md, "Reglas del juego").

/** 0 huevo, 1 bebé, 2 joven, 3 adulto, 4 leyenda. */
export type Stage = 0 | 1 | 2 | 3 | 4;
export type Mood = 'feliz' | 'normal' | 'cansada' | 'triste';

export interface CreatureRules {
  /** XP por hacer un hábito: xpBase + xpPerEffort × esfuerzo. */
  xpBase: number;
  xpPerEffort: number;
  /** XP que se pierde al fallarlo: penaltyPerMissingEffort × (penaltyBase − esfuerzo). */
  penaltyPerMissingEffort: number;
  penaltyBase: number;
  streakBonusPerWeek: number;
  streakBonusMax: number;
  /** XP para llegar a cada etapa. */
  stageXp: [number, number, number, number, number];
  /** Para bajar de etapa, la XP tiene que caer por debajo de este % de su umbral. */
  demoteRatio: number;
  /** Días programados que se miran para el ánimo, y mínimo para calcularlo. */
  moodWindow: number;
  moodMinDays: number;
  /** Mínimo de cumplimiento para cada ánimo (por debajo de "cansada", triste). */
  moodBands: { feliz: number; normal: number; cansada: number };
  /** XP de entrenador por tarea según prioridad (1 alta, 2 media, 3 baja). */
  taskXp: Record<1 | 2 | 3, number>;
  taskXpDailyCap: number;
  freezeMax: number;
  /** Primer lunes con misiones: el historial anterior no da premios. */
  missionsStart: string;
  /** XP de entrenador por cada misión. */
  missionRewards: { habit: number; tasks: number; perfect: number; xp: number };
  missionTasksMin: number;
  missionTasksMax: number;
  missionPerfectDays: number;
  missionXpMin: number;
  /** La misión de XP pide esto por lo ganado la semana anterior: repetir la semana basta. */
  missionXpFactor: number;
}

export const DEFAULT_CREATURE_RULES: CreatureRules = {
  xpBase: 10,
  xpPerEffort: 5,
  penaltyPerMissingEffort: 5,
  penaltyBase: 6,
  streakBonusPerWeek: 0.05,
  streakBonusMax: 0.5,
  stageXp: [0, 50, 500, 1500, 4000],
  demoteRatio: 0.8,
  moodWindow: 7,
  moodMinDays: 3,
  moodBands: { feliz: 0.8, normal: 0.5, cansada: 0.2 },
  taskXp: { 1: 5, 2: 3, 3: 2 },
  taskXpDailyCap: 25,
  freezeMax: 2,
  missionsStart: '2026-11-02',
  missionRewards: { habit: 30, tasks: 40, perfect: 50, xp: 40 },
  missionTasksMin: 5,
  missionTasksMax: 10,
  missionPerfectDays: 3,
  missionXpMin: 100,
  missionXpFactor: 0.9,
};

export const BACKGROUNDS = [
  'coliseo',
  'barco',
  'biblioteca',
  'playa',
  'dojo',
  'estadio',
  'templo',
  'cine',
] as const;
export const AURAS = ['dorada', 'confeti', 'llamas', 'estrellas'] as const;

/** Etapa que corresponde a `xp` partiendo de `current`: sube por umbral y solo baja con margen. */
export function nextStage(
  xp: number,
  current: Stage,
  rules: CreatureRules = DEFAULT_CREATURE_RULES,
): Stage {
  let stage = current;
  while (stage < 4 && xp >= rules.stageXp[stage + 1]!) stage = (stage + 1) as Stage;
  while (stage > 0 && xp < rules.demoteRatio * rules.stageXp[stage]!) stage = (stage - 1) as Stage;
  return stage;
}

/** Nivel n a partir de 100·n·(n−1) XP. */
export function trainerLevel(xp: number): number {
  let n = 1;
  while (100 * (n + 1) * n <= xp) n++;
  return n;
}
