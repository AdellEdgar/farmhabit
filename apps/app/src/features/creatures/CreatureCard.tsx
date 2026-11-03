import { speciesById, type Creature } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { ProgressBar } from '../../components/ui';
import { CreatureImage } from './CreatureImage';
import { MOOD_LABEL, stageName, stageProgress } from './creature-meta';

/** Tarjeta de una criatura en el equipo. */
export function CreatureCard({
  creature: c,
  habitName,
  onOpen,
}: {
  creature: Creature;
  habitName: string;
  onOpen: () => void;
}) {
  const progress = stageProgress(c);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'flex w-full items-center gap-4 rounded-2xl border border-borde bg-superficie p-4 text-left transition hover:border-texto-suave',
        c.archived && 'opacity-70',
      )}
    >
      <CreatureImage species={c.species} stage={c.stage} px={88} mood={c.mood} aura={c.aura} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{c.name}</p>
        <p className="truncate text-xs text-texto-suave">
          {stageName(c)} · {speciesById(c.species)?.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-texto-suave">{habitName}</p>
        {progress ? (
          <>
            <ProgressBar value={progress.fraction * 100} className="mt-2" />
            <p className="mt-1 text-[11px] text-texto-suave tabular-nums">
              {c.xp} / {progress.to} XP
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs font-semibold text-grano">★ Leyenda · {c.xp} XP</p>
        )}
        {!c.archived && <p className="mt-1 text-xs">{MOOD_LABEL[c.mood]}</p>}
      </div>
    </button>
  );
}
