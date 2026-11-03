import type { LocalDate } from '../util/dates';
import type { Stage } from './creature-rules';
import type { Creature, CreatureEvent } from './creatures';

// Qué celebrar en este dispositivo. La etapa de hoy es provisional (marcar y
// desmarcar la mueve), así que se recuerda la etapa más alta ya celebrada y
// los retrocesos se avisan por su evento en la historia, que solo existe en
// días cerrados.

export interface SeenState {
  /** Etapa más alta ya celebrada. */
  maxStage: number;
  /** Fecha del último retroceso del que ya se avisó. */
  lastDemote: LocalDate | null;
}

export interface CelebrationResult {
  celebrate: boolean;
  /** La celebración es de eclosión (salió del huevo). */
  hatched: boolean;
  /** Retrocesos nuevos de los que avisar. */
  demotions: CreatureEvent[];
  /** Lo que hay que guardar para la próxima vez. */
  seen: SeenState;
}

export function celebrationsFor(
  creature: Pick<Creature, 'history'> & { stage: Stage | number },
  seen: SeenState | null,
): CelebrationResult {
  const demotes = creature.history.filter((e) => e.type === 'demote');
  const lastDemote = demotes.at(-1)?.date ?? null;
  // Primera vez en este dispositivo: solo se apunta (no lanzar decenas al actualizar).
  if (seen === null) {
    return {
      celebrate: false,
      hatched: false,
      demotions: [],
      seen: { maxStage: creature.stage, lastDemote },
    };
  }
  const celebrate = creature.stage > seen.maxStage;
  return {
    celebrate,
    hatched: celebrate && seen.maxStage === 0,
    demotions: demotes.filter((e) => seen.lastDemote === null || e.date > seen.lastDemote),
    seen: {
      maxStage: Math.max(seen.maxStage, creature.stage),
      lastDemote: lastDemote ?? seen.lastDemote,
    },
  };
}
