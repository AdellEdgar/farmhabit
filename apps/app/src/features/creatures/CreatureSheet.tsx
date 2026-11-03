import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  addDays,
  habitCalendar,
  SPECIES,
  speciesById,
  type CreatureEvent,
  type DayStatus,
  type Habit,
  type Stage,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { useNavigation } from '../../lib/navigation';
import { formatRelativeDate } from '../../lib/format';
import { cx } from '../../lib/cx';
import { Button, Chip, Dialog, Field, Input, ProgressBar } from '../../components/ui';
import { backgroundUrl } from './assets';
import { CreatureImage } from './CreatureImage';
import {
  AURA_NAMES,
  BACKGROUND_NAMES,
  MOOD_LABEL,
  stageName,
  stageProgress,
} from './creature-meta';

const DAY_COLOR: Record<DayStatus, string> = {
  done: 'bg-acento',
  partial: 'bg-acento/50',
  skipped: 'bg-info/60',
  missed: 'bg-peligro',
  pending: 'border border-dashed border-texto-suave',
  off: 'bg-elevado',
};

function eventText(
  e: CreatureEvent,
  name: string,
  species: Parameters<typeof stageName>[0]['species'],
): string {
  const stage = stageName({ species, stage: e.stage });
  if (e.type === 'hatch') return `Eclosionó ${name}`;
  if (e.type === 'evolve') return `Evolucionó a ${stage}`;
  return `Retrocedió a ${stage}`;
}

/** Ficha de una criatura: progreso, historia y personalización. */
export function CreatureSheet({ habitId, onClose }: { habitId: string; onClose: () => void }) {
  const { game, data, mutate, today } = useApp();
  const { go } = useNavigation();
  const c = game.creatures.find((x) => x.habitId === habitId);
  const habit = data.allHabits.find((h) => h.id === habitId);
  const [name, setName] = useState(c?.name ?? '');
  if (!c || !habit) return null;

  const update = (
    patch: Partial<
      Pick<Habit, 'creatureName' | 'creatureSpecies' | 'creatureBackground' | 'creatureAura'>
    >,
  ) => mutate((db) => db.repo('habits').update(habitId, patch));
  const saveName = () => {
    const clean = name.trim().slice(0, 50);
    if (clean !== c.name) void update({ creatureName: clean });
  };

  const progress = stageProgress(c);
  const week = habitCalendar(habit, data.habitLogs, addDays(today, -6), today, today);
  const bg = c.background ? backgroundUrl(c.background) : null;
  const ownedBackgrounds = game.owned
    .filter((i) => i.startsWith('background:'))
    .map((i) => i.slice(11));
  const ownedAuras = game.owned.filter((i) => i.startsWith('aura:')).map((i) => i.slice(5));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={c.name} wide>
      <div
        className="grid place-items-center rounded-2xl bg-elevado bg-cover bg-center py-6"
        style={bg ? { backgroundImage: `url(${bg})` } : undefined}
      >
        <CreatureImage
          species={c.species}
          stage={c.stage}
          px={180}
          mood={c.archived ? undefined : c.mood}
          aura={c.aura}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="font-semibold">
            {stageName(c)} · {speciesById(c.species)?.name}
          </p>
          <p className="text-sm text-texto-suave">Hábito: {habit.name}</p>
          {!c.archived && <p className="text-sm">{MOOD_LABEL[c.mood]}</p>}
          {progress ? (
            <>
              <ProgressBar value={progress.fraction * 100} className="mt-2" />
              <p className="text-xs text-texto-suave tabular-nums">
                {c.xp} XP · faltan {progress.to - c.xp} para la siguiente etapa
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-grano">★ Leyenda · {c.xp} XP</p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-texto-suave uppercase">
            Últimos 7 días
          </p>
          <ul className="flex gap-1.5">
            {week.map((d) => (
              <li
                key={d.date}
                title={formatRelativeDate(d.date, today)}
                className={cx('size-6 rounded-md', DAY_COLOR[d.status])}
              />
            ))}
          </ul>
          <Button
            variant="ghost"
            className="mt-2 -ml-2"
            onClick={() => {
              onClose();
              go('habitos');
            }}
          >
            <BarChart3 size={16} /> Estadísticas del hábito
          </Button>
        </div>
      </div>

      <Field label="Nombre">
        <Input
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
        />
      </Field>

      <Field label="Especie">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {SPECIES.map((s) => {
            const locked = !game.unlockedSpecies.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                disabled={locked}
                title={locked ? `${s.name} (nivel ${s.unlockLevel})` : s.name}
                onClick={() => void update({ creatureSpecies: s.id })}
                aria-pressed={s.id === c.species}
                className={cx(
                  'grid place-items-center rounded-xl border p-1 transition disabled:opacity-30',
                  s.id === c.species
                    ? 'border-acento bg-acento-suave'
                    : 'border-borde hover:border-texto-suave',
                )}
              >
                <CreatureImage species={s.id} stage={Math.max(1, c.stage) as Stage} px={44} />
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fondo">
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={c.background === null}
              onClick={() => void update({ creatureBackground: null })}
            >
              Ninguno
            </Chip>
            {ownedBackgrounds.map((id) => (
              <Chip
                key={id}
                active={c.background === id}
                onClick={() => void update({ creatureBackground: id })}
              >
                {BACKGROUND_NAMES[id]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Aura">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={c.aura === null} onClick={() => void update({ creatureAura: null })}>
              Ninguna
            </Chip>
            {ownedAuras.map((id) => (
              <Chip
                key={id}
                active={c.aura === id}
                onClick={() => void update({ creatureAura: id })}
              >
                {AURA_NAMES[id]}
              </Chip>
            ))}
          </div>
        </Field>
      </div>
      {ownedBackgrounds.length + ownedAuras.length === 0 && (
        <p className="text-xs text-texto-suave">
          Compra fondos y auras en la tienda para personalizarla.
        </p>
      )}

      {c.history.length > 0 && (
        <section>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-texto-suave uppercase">
            Su historia
          </p>
          <ul className="space-y-1 text-sm">
            {[...c.history].reverse().map((e) => (
              <li key={`${e.date}|${e.type}|${e.stage}`} className="flex justify-between gap-3">
                <span>{eventText(e, c.name, c.species)}</span>
                <span className="text-texto-suave">{formatRelativeDate(e.date, today)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  );
}
