import { ChevronRight } from 'lucide-react';
import { stableRandom } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Card, ProgressBar } from '../../components/ui';
import { CreatureImage } from './CreatureImage';
import { creaturePhrase, levelXp } from './creature-meta';
import { MissionsCard } from './MissionsCard';
import { SpeechBubble } from './SpeechBubble';

/** "Tu equipo" en Hoy: las criaturas con su ánimo, el nivel y las pesetas. */
export function TeamStrip({ onOpen }: { onOpen: () => void }) {
  const { game, today } = useApp();
  const team = game.creatures.filter((c) => !c.archived);
  const from = levelXp(game.level);
  const to = levelXp(game.level + 1);
  const [sad] = game.alerts;
  // Una sola frase al día, de una criatura distinta cada día.
  const talkers = team.filter((c) => c.stage > 0);
  const talker = talkers[Math.floor(stableRandom(today) * talkers.length)];
  const phrase = talker ? creaturePhrase(talker, today) : null;

  return (
    <Card className="p-4">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Tu equipo</p>
          <ChevronRight size={18} className="text-texto-suave" />
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-texto-suave">
          <span>Entrenador nivel {game.level}</span>
          <span>
            <b className="text-grano">{game.pesetas}</b> pesetas
          </span>
        </div>
        <ProgressBar value={((game.trainerXp - from) / (to - from)) * 100} className="mt-1.5" />

        {team.length === 0 ? (
          <p className="mt-3 text-sm text-texto-suave">
            Crea un hábito y recibirás tu primer huevo.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {team.map((c) => (
              <li key={c.habitId} className="flex w-14 flex-col items-center gap-0.5">
                <CreatureImage
                  species={c.species}
                  stage={c.stage}
                  px={48}
                  mood={c.mood}
                  aura={c.aura}
                />
                <span className="w-full truncate text-center text-[10px] text-texto-suave">
                  {c.name}
                </span>
              </li>
            ))}
          </ul>
        )}

        {talker && phrase && <SpeechBubble text={`${talker.name}: ${phrase}`} className="mt-3" />}

        {sad && (
          <p className="mt-2 rounded-lg bg-aviso/10 px-2 py-1.5 text-xs text-aviso">
            {game.alerts.length === 1
              ? `${sad.name} retrocederá si hoy no haces su hábito.`
              : `${sad.name} y ${game.alerts.length - 1} más retrocederán si hoy no haces sus hábitos.`}
          </p>
        )}
        <MissionsCard compact />
      </button>
    </Card>
  );
}
