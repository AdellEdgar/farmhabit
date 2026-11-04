import { Shield } from 'lucide-react';
import { DEFAULT_CREATURE_RULES, SPECIES } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Card, ProgressBar } from '../../components/ui';
import { levelXp } from './creature-meta';

/** Nivel de entrenador y comodines. */
export function TrainerCard() {
  const { game } = useApp();
  const from = levelXp(game.level);
  const to = levelXp(game.level + 1);

  return (
    <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg font-bold">Entrenador nivel {game.level}</p>
          <p className="text-xs text-texto-suave tabular-nums">
            {game.trainerXp} / {to} XP
          </p>
        </div>
        <ProgressBar value={((game.trainerXp - from) / (to - from)) * 100} className="mt-2" />
        <p className="mt-1.5 text-xs text-texto-suave">
          {SPECIES.filter((s) => game.seenStages[s.id].length > 0).length} de 16 especies
          descubiertas
        </p>
      </div>
      <div className="flex gap-3 text-sm">
        <span
          className="inline-flex items-center gap-1.5 rounded-xl bg-elevado px-3 py-2"
          title="Protegen solos un día con fallos. Se ganan cumpliendo las misiones de hábitos de la semana."
        >
          <Shield size={15} className="text-info" />
          <b className="tabular-nums">
            {game.freezes}/{DEFAULT_CREATURE_RULES.freezeMax}
          </b>{' '}
          comodines
        </span>
      </div>
    </Card>
  );
}
