import { Trophy } from 'lucide-react';
import { useApp } from '../../lib/use-app';
import { formatRelativeDate } from '../../lib/format';
import { cx } from '../../lib/cx';
import { Card } from '../../components/ui';
import { VacationCard } from './VacationCard';

/** Pestaña Logros, con las vacaciones al lado. */
export function AchievementsTab() {
  const { game, today } = useApp();
  const got = game.achievements.filter((a) => a.unlockedOn !== null).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section>
        <p className="mb-3 text-sm text-texto-suave">
          {got} de {game.achievements.length} logros
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {game.achievements.map((a) => (
            <li key={a.id}>
              <Card
                className={cx('flex items-center gap-3 p-3', a.unlockedOn === null && 'opacity-60')}
              >
                <Trophy
                  size={26}
                  className={cx('shrink-0', a.unlockedOn ? 'text-grano' : 'text-texto-suave')}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-texto-suave">{a.description}</p>
                  <p className="mt-0.5 text-[11px] text-texto-suave">
                    {a.unlockedOn
                      ? `Conseguido ${formatRelativeDate(a.unlockedOn, today).toLowerCase()}`
                      : `Premio: ${a.reward} pesetas`}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <div className="self-start">
        <VacationCard />
      </div>
    </div>
  );
}
