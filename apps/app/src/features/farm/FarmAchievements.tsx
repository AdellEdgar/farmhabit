import { useMemo } from 'react';
import { computeAchievements } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { useApp } from '../../lib/use-app';
import { Card, ProgressBar } from '../../components/ui';

export function FarmAchievements() {
  const { data, farm } = useApp();
  const list = useMemo(
    () =>
      computeAchievements({
        farm,
        habits: data.allHabits,
        logs: data.habitLogs,
        tasks: data.tasks,
        taskCompletions: data.taskCompletions,
      }),
    [farm, data],
  );
  const unlocked = list.filter((a) => a.unlocked).length;

  return (
    <>
      <p className="mb-4 text-sm text-texto-suave">
        {unlocked} de {list.length} logros conseguidos
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((a) => (
          <Card
            key={a.id}
            className={cx('flex items-center gap-4 p-4', !a.unlocked && 'opacity-75')}
          >
            <span
              className={cx(
                'grid size-12 shrink-0 place-items-center rounded-xl text-2xl',
                a.unlocked ? 'bg-acento-suave' : 'bg-elevado grayscale',
              )}
              aria-hidden="true"
            >
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-texto-suave">{a.description}</p>
              {!a.unlocked && (
                <ProgressBar value={a.progress * 100} className="mt-2 h-1.5" color="bg-info" />
              )}
            </div>
            {a.unlocked && (
              <span className="text-acento" aria-label="Conseguido">
                ✓
              </span>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
