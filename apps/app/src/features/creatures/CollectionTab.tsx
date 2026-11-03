import { Lock } from 'lucide-react';
import { SPECIES, type Stage } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Card } from '../../components/ui';
import { CreatureImage } from './CreatureImage';

const STAGES: Stage[] = [1, 2, 3, 4];

/** Pestaña Colección: las 16 especies y sus 4 etapas, vistas o por descubrir. */
export function CollectionTab() {
  const { game } = useApp();
  const seenSpecies = SPECIES.filter((s) => game.seenStages[s.id].length > 0).length;
  const seenStages = SPECIES.reduce((n, s) => n + game.seenStages[s.id].length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-texto-suave">
        {seenSpecies} de 16 especies · {seenStages} de 64 etapas descubiertas
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {SPECIES.map((s) => {
          const locked = !game.unlockedSpecies.includes(s.id);
          const seen = game.seenStages[s.id];
          return (
            <Card key={s.id} className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold">{s.name}</p>
                {locked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
                    <Lock size={13} /> Nivel {s.unlockLevel}
                  </span>
                ) : (
                  <span className="text-xs text-texto-suave">{seen.length}/4</span>
                )}
              </div>
              <ul className="grid grid-cols-4 gap-2">
                {STAGES.map((stage) => {
                  const known = seen.includes(stage);
                  return (
                    <li key={stage} className="flex flex-col items-center gap-1 text-center">
                      <CreatureImage
                        species={s.id}
                        stage={stage}
                        px={64}
                        silhouette={!known}
                        className={locked ? 'opacity-40' : undefined}
                      />
                      <span className="text-[10px] leading-tight text-texto-suave">
                        {known ? s.stageNames[stage - 1] : '???'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
