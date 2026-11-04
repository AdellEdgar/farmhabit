import { Check } from 'lucide-react';
import type { Mission } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { cx } from '../../lib/cx';
import { Card, ProgressBar } from '../../components/ui';
import { missionTitle } from './creature-meta';

function MissionRow({ mission: m, compact }: { mission: Mission; compact?: boolean }) {
  const { data } = useApp();
  const done = m.doneOn !== null;
  const habitName = data.allHabits.find((h) => h.id === m.habitId)?.name ?? '';
  return (
    <li>
      <div
        className={cx('flex items-center justify-between gap-2', compact ? 'text-xs' : 'text-sm')}
      >
        <span className={cx('min-w-0 truncate', done && 'text-texto-suave line-through')}>
          {missionTitle(m, habitName)}
        </span>
        {done ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-acento">
            <Check size={14} /> +{m.reward}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-texto-suave tabular-nums">
            {m.progress}/{m.target}
            {!compact && <span className="text-grano"> · +{m.reward} XP</span>}
          </span>
        )}
      </div>
      <ProgressBar value={(m.progress / m.target) * 100} className="mt-1" />
    </li>
  );
}

/** Misiones de esta semana. Sin misiones no se pinta. */
export function MissionsCard({ compact }: { compact?: boolean }) {
  const { game } = useApp();
  if (game.missions.length === 0) return null;
  const list = (
    <ul className="space-y-2">
      {game.missions.map((m) => (
        <MissionRow key={m.id} mission={m} compact={compact} />
      ))}
    </ul>
  );
  if (compact) {
    return (
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium tracking-wide text-texto-suave uppercase">
          Misiones
        </p>
        {list}
      </div>
    );
  }
  return (
    <Card className="p-4">
      <p className="font-semibold">Misiones de la semana</p>
      {game.missions.some((m) => m.kind === 'habit') ? (
        <p className="mb-3 text-xs text-texto-suave">
          Cumple todas menos la de tareas y ganarás un comodín.
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {list}
    </Card>
  );
}
