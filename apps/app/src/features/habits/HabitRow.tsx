import { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, SkipForward } from 'lucide-react';
import {
  configOn,
  habitLogId,
  habitStreak,
  logRatio,
  setHabitLog,
  type Habit,
  type LocalDate,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { cx } from '../../lib/cx';
import { CheckCircle, IconButton } from '../../components/ui';
import { CreatureImage } from '../creatures/CreatureImage';
import { CreatureSheet } from '../creatures/CreatureSheet';
import { formatQuantity, penaltyFor, rewardFor, streakUnit } from './habit-meta';

export function HabitRow({
  habit,
  date,
  compact,
  onOpen,
}: {
  habit: Habit;
  date: LocalDate;
  compact?: boolean;
  onOpen?: (h: Habit) => void;
}) {
  const { data, game, mutate, today } = useApp();
  const creature = game.creatures.find((c) => c.habitId === habit.id);
  const [sheet, setSheet] = useState(false);
  // "+N XP" flotante y saltito de la criatura al marcarlo como hecho.
  const [burst, setBurst] = useState<{ xp: number; key: number } | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(burstTimer.current), []);
  const cfg = configOn(habit, date)!;
  const log = data.habitLogs.find((l) => l.id === habitLogId(habit.id, date));
  const ratio = logRatio(log, cfg);
  const done = ratio !== null && ratio >= 1;
  const skipped = log?.status === 'skipped';
  const streak = useMemo(
    () => habitStreak(habit, data.habitLogs, today),
    [habit, data.habitLogs, today],
  );
  // Borrador mientras se escribe; si no, se muestra lo guardado.
  const [draftQty, setDraftQty] = useState<string | null>(null);
  const qty = draftQty ?? (log?.value != null ? String(log.value) : '');

  const setLog = (input: Parameters<typeof setHabitLog>[3]) =>
    mutate((db) => setHabitLog(db, habit.id, date, input, today));

  const celebrate = () => {
    clearTimeout(burstTimer.current);
    setBurst({ xp: rewardFor(cfg.effort), key: (burst?.key ?? 0) + 1 });
    burstTimer.current = setTimeout(() => setBurst(null), 1200);
  };

  const toggleDone = async () => {
    const marking = !(done || skipped);
    const ok = await setLog(
      marking
        ? { status: 'done', value: cfg.target ? cfg.target.quantity : null }
        : { status: 'none' },
    );
    if (ok !== undefined && marking) celebrate();
  };

  const saveQty = (raw: string) => {
    setDraftQty(null);
    const v = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(v) || v <= 0) {
      if (log) void setLog({ status: 'none' });
      return;
    }
    if (v !== log?.value) void setLog({ status: 'done', value: v });
  };

  const unit = streakUnit(streak.unit, streak.current);

  return (
    <li
      className={cx(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-elevado',
        skipped && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => setSheet(true)}
        disabled={!creature}
        className="relative shrink-0"
        aria-label={creature ? `Ver a ${creature.name}` : undefined}
      >
        {creature ? (
          <CreatureImage
            key={`criatura-${burst?.key ?? 0}`}
            species={creature.species}
            stage={creature.stage}
            px={44}
            mood={creature.mood}
            className={burst ? 'creature-jump' : undefined}
          />
        ) : (
          <span className="grid size-11 place-items-center rounded-xl bg-elevado text-xl">✨</span>
        )}
        {burst && (
          <span
            key={`xp-${burst.key}`}
            className="xp-burst pointer-events-none absolute -top-2 left-1/2 text-xs font-bold whitespace-nowrap text-acento"
            aria-live="polite"
          >
            +{burst.xp} XP
          </span>
        )}
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen?.(habit)}
        disabled={!onOpen}
      >
        <p className={cx('truncate text-[15px] font-medium', done && 'text-texto-suave')}>
          {habit.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-texto-suave">
          <span>
            <span className="text-acento">+{rewardFor(cfg.effort)}</span>
            {!compact && <span className="text-peligro"> / −{penaltyFor(cfg.effort)}</span>}
          </span>
          {streak.current > 0 && (
            <span className="inline-flex items-center gap-0.5 text-aviso">
              <Flame size={12} /> {streak.current} {unit}
            </span>
          )}
          {cfg.target && (
            <span>
              {formatQuantity(log?.value ?? 0)} / {formatQuantity(cfg.target.quantity)}{' '}
              {cfg.target.unit}
            </span>
          )}
          {skipped && <span>Saltado</span>}
        </div>
      </button>

      {cfg.target && !compact && (
        <input
          inputMode="decimal"
          aria-label={`Cantidad de ${habit.name}`}
          placeholder="0"
          value={qty}
          onChange={(e) => setDraftQty(e.target.value)}
          onBlur={(e) => saveQty(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-16 rounded-lg border border-borde bg-fondo px-2 py-1.5 text-right text-sm focus:border-acento focus:outline-none"
        />
      )}
      {!compact && (
        <IconButton
          label={skipped ? 'Quitar saltado' : 'Saltar hoy (no rompe la racha)'}
          onClick={() => setLog(skipped ? { status: 'none' } : { status: 'skipped' })}
          className={cx(skipped && 'text-info')}
        >
          <SkipForward size={17} />
        </IconButton>
      )}
      <CheckCircle
        checked={done}
        onChange={() => void toggleDone()}
        label={done ? 'Desmarcar' : `Marcar ${habit.name} como hecho`}
        color={habit.color || undefined}
      />
      {sheet && creature && <CreatureSheet habitId={habit.id} onClose={() => setSheet(false)} />}
    </li>
  );
}
