import { useApp } from '../../lib/use-app';
import { useNavigation } from '../../lib/navigation';
import { Button, EmptyState } from '../../components/ui';
import { CreatureCard } from './CreatureCard';
import { TrainerCard } from './TrainerCard';

/** Pestaña Equipo: entrenador y una tarjeta por criatura. */
export function TeamTab({ onOpen }: { onOpen: (habitId: string) => void }) {
  const { game, data } = useApp();
  const { go } = useNavigation();
  const habitName = (id: string) => data.allHabits.find((h) => h.id === id)?.name ?? '';
  const active = game.creatures.filter((c) => !c.archived);
  const resting = game.creatures.filter((c) => c.archived);

  return (
    <div className="space-y-5">
      <TrainerCard />

      {active.length === 0 ? (
        <EmptyState icon="🥚" title="Aún no tienes criaturas">
          Cada hábito que creas trae un huevo. Hazlo y verás nacer a tu criatura.
          <div className="mt-4">
            <Button variant="primary" onClick={() => go('habitos')}>
              Crear un hábito
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((c) => (
            <CreatureCard
              key={c.habitId}
              creature={c}
              habitName={habitName(c.habitId)}
              onOpen={() => onOpen(c.habitId)}
            />
          ))}
        </div>
      )}

      {resting.length > 0 && (
        <details className="rounded-2xl border border-borde bg-superficie p-4">
          <summary className="cursor-pointer font-semibold">Descansando ({resting.length})</summary>
          <p className="mt-1 text-sm text-texto-suave">
            Sus hábitos están archivados: su XP está congelada hasta que los reactives.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {resting.map((c) => (
              <CreatureCard
                key={c.habitId}
                creature={c}
                habitName={habitName(c.habitId)}
                onOpen={() => onOpen(c.habitId)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
