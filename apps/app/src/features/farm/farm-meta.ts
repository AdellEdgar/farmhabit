import { DEFAULT_RULES, type FarmState } from '@farmhabit/core';

export const SPECIES_EMOJI: Record<string, string> = {
  chicken: '🐔',
  rabbit: '🐰',
  sheep: '🐑',
  pig: '🐷',
  cow: '🐮',
  horse: '🐴',
};

export const SPECIES_NAME: Record<string, string> = {
  chicken: 'Gallina',
  rabbit: 'Conejo',
  sheep: 'Oveja',
  pig: 'Cerdo',
  cow: 'Vaca',
  horse: 'Caballo',
};

export function wellbeingColor(w: number): string {
  if (w < DEFAULT_RULES.sickBelow) return 'bg-peligro';
  if (w < DEFAULT_RULES.happyAbove) return 'bg-aviso';
  return 'bg-acento';
}

export function wellbeingLabel(farm: FarmState): string {
  if (farm.sick) return 'Tus animales están enfermos';
  if (farm.wellbeing >= DEFAULT_RULES.happyAbove) return 'Tus animales están contentos';
  if (farm.wellbeing >= DEFAULT_RULES.sickBelow) return 'Tus animales están tristes';
  return 'Tus animales están a punto de enfermar';
}
