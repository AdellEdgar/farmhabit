import { DEFAULT_CREATURE_RULES, speciesById, type Creature, type Mood } from '@farmhabit/core';

// Textos de la sección Criaturas.

export const MOOD_LABEL: Record<Mood, string> = {
  feliz: '😄 Feliz',
  normal: '🙂 Normal',
  cansada: '😪 Cansada',
  triste: '😢 Triste',
};

export const BACKGROUND_NAMES: Record<string, string> = {
  coliseo: 'Coliseo',
  barco: 'Barco pirata',
  biblioteca: 'Biblioteca',
  playa: 'Playa',
  dojo: 'Dojo',
  estadio: 'Estadio',
  templo: 'Templo griego',
  cine: 'Cine mudo',
};

export const AURA_NAMES: Record<string, string> = {
  dorada: 'Dorada',
  confeti: 'Confeti',
  llamas: 'Llamas',
  estrellas: 'Estrellas',
};

/** "Huevo", "Pandita"… */
export function stageName(c: Pick<Creature, 'species' | 'stage'>): string {
  if (c.stage === 0) return 'Huevo';
  return speciesById(c.species)?.stageNames[c.stage - 1] ?? '';
}

/** Progreso hasta la siguiente etapa (null si ya es leyenda). */
export function stageProgress(c: Pick<Creature, 'stage' | 'xp'>): {
  from: number;
  to: number;
  fraction: number;
} | null {
  if (c.stage >= 4) return null;
  const from = DEFAULT_CREATURE_RULES.stageXp[c.stage]!;
  const to = DEFAULT_CREATURE_RULES.stageXp[c.stage + 1]!;
  return { from, to, fraction: Math.max(0, Math.min(1, (c.xp - from) / (to - from))) };
}

/** XP necesaria para el nivel n de entrenador. */
export function levelXp(level: number): number {
  return 100 * level * (level - 1);
}
