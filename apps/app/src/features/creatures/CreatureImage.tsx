import { speciesById, type Mood, type SpeciesId, type Stage } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { creatureImageUrl } from './assets';

/**
 * Criatura en su etapa. Con imagen si ya existe; si no, el emoji de la especie
 * (o un huevo) sobre un círculo. El ánimo y el aura son efectos de CSS
 * (styles.css), así no hacen falta imágenes extra.
 */
export function CreatureImage({
  species,
  stage,
  px,
  mood,
  aura,
  silhouette,
  className,
}: {
  species: SpeciesId;
  stage: Stage;
  /** Tamaño en píxeles CSS. */
  px: number;
  mood?: Mood;
  aura?: string | null;
  /** Etapa aún no vista (colección): solo la silueta. */
  silhouette?: boolean;
  className?: string;
}) {
  const url = creatureImageUrl(species, stage, px > 96 ? 512 : 128);
  const info = speciesById(species);
  const label = stage === 0 ? 'Huevo' : `${info?.name ?? species}, ${info?.stageNames[stage - 1]}`;

  return (
    <span
      className={cx(
        'creature relative inline-grid shrink-0 place-items-center',
        mood && `mood-${mood}`,
        aura && `aura aura-${aura}`,
        silhouette && 'creature-silhouette',
        className,
      )}
      style={{ width: px, height: px }}
      role="img"
      aria-label={label}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          className="creature-body size-full object-contain"
        />
      ) : (
        <span
          className="creature-body grid size-full place-items-center rounded-full bg-elevado"
          style={{ fontSize: px * (stage === 0 ? 0.5 : 0.35 + stage * 0.06) }}
          aria-hidden="true"
        >
          {stage === 0 ? '🥚' : info?.emoji}
        </span>
      )}
      {mood === 'triste' && (
        <span
          className="creature-cloud"
          style={{ fontSize: Math.max(12, px * 0.28) }}
          aria-hidden="true"
        >
          ☁️
        </span>
      )}
    </span>
  );
}
