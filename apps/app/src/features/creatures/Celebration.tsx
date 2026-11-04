import { useEffect, useRef, useState } from 'react';
import { celebrationsFor, pickPhrase, type Creature, type SeenState } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Button } from '../../components/ui';
import { CreatureImage } from './CreatureImage';
import { SpeechBubble } from './SpeechBubble';
import { stageName } from './creature-meta';

/** Lo ya celebrado en este dispositivo (meta local, no se sincroniza). */
const seenKey = (habitId: string) => `creatures:seen:${habitId}`;

function parseSeen(stored: string | null): SeenState | null {
  if (stored === null) return null;
  try {
    return JSON.parse(stored) as SeenState;
  } catch {
    return null;
  }
}

/**
 * Celebra a pantalla completa cuando una criatura nace o evoluciona, una vez
 * por dispositivo. Si retrocede, solo un aviso discreto. La primera vez que
 * ve una criatura solo apunta su etapa, para no lanzar decenas de
 * celebraciones al actualizar la app.
 */
export function Celebration() {
  const { db, game, toast } = useApp();
  const [queue, setQueue] = useState<{ creature: Creature; hatched: boolean }[]>([]);
  const checking = useRef(false);

  useEffect(() => {
    if (checking.current) return;
    checking.current = true;
    void (async () => {
      const found: typeof queue = [];
      for (const c of game.creatures) {
        if (c.archived) continue;
        const key = seenKey(c.habitId);
        const stored = await db.getMeta(key);
        const result = celebrationsFor(c, parseSeen(stored));
        const next = JSON.stringify(result.seen);
        if (next !== stored) await db.setMeta(key, next);
        if (result.celebrate) found.push({ creature: c, hatched: result.hatched });
        for (const e of result.demotions)
          toast(
            `${c.name} ha retrocedido a ${stageName({ species: c.species, stage: e.stage })}. ¡Haz su hábito para que se recupere!`,
          );
      }
      if (found.length > 0) setQueue((q) => [...q, ...found]);
    })().finally(() => {
      checking.current = false;
    });
  }, [db, game.creatures, toast]);

  const current = queue[0];
  if (!current) return null;
  const { creature: c, hatched } = current;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={hatched ? `${c.name} ha nacido` : `${c.name} ha evolucionado`}
    >
      <div className="celebrate-pop flex max-w-sm flex-col items-center gap-4 rounded-3xl border border-borde bg-superficie p-8 text-center shadow-2xl">
        <CreatureImage species={c.species} stage={c.stage} px={200} aura={c.aura ?? 'dorada'} />
        <div>
          <p className="text-2xl font-bold">
            {hatched ? `¡${c.name} ha nacido!` : `¡${c.name} ha evolucionado!`}
          </p>
          <p className="mt-1 text-texto-suave">
            {hatched ? 'Ha salido del huevo' : `Ahora es ${stageName(c)}`}. Sigue así.
          </p>
        </div>
        <SpeechBubble text={pickPhrase(c.species, 'evolucion', `${c.habitId}|${c.stage}`)} />
        <Button variant="primary" autoFocus onClick={() => setQueue((q) => q.slice(1))}>
          ¡Genial!
        </Button>
      </div>
    </div>
  );
}
