import type { SpeciesId, Stage } from '@farmhabit/core';

// Imágenes de las criaturas y de los fondos, generadas por scripts/criaturas.mjs.
// Solo se importan las URL: el navegador descarga cada imagen cuando se pinta.
// Si falta alguna, se usa el marcador (emoji) de CreatureImage.

const files = import.meta.glob<string>('../../assets/criaturas/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byName = new Map(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -5), url]),
);

export function creatureImageUrl(species: SpeciesId, stage: Stage, size: 128 | 512): string | null {
  const name = stage === 0 ? 'huevo' : `${species}-${stage}`;
  return byName.get(`${name}-${size}`) ?? null;
}

export function backgroundUrl(id: string): string | null {
  return byName.get(`fondo-${id}`) ?? null;
}
