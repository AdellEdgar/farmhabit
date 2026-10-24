import { useState } from 'react';
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
  const { data, mutate, today } = useApp();
  const cfg = configOn(habit, date)!;
  const log = data.habitLogs.find((l) => l.id === habitLogId(habit.id, date));
  const ratio = logRatio(log, cfg);
  const done = ratio !== null && ratio >= 1;
  const skipped = log?.status === 'skipped';
  const streak = habitStreak(habit, data.habitLogs, today);
  // Borrador mientras se escribe; si no, se muestra lo guardado.
  const [draftQty, setDraftQty] = useState<string | null>(null);
  const qty = draftQty ?? (log?.value != null ? String(log.value) : '');

  const setLog = (input: Parameters<typeof setHabitLog>[3]) =>
    mutate((db) => setHabitLog(db, habit.id, date, input, today));

  const toggleDone = () =>
    setLog(
      done || skipped
        ? { status: 'none' }
        : { status: 'done', value: cfg.target ? cfg.target.quantity : null },
    );

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
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl text-xl"
        style={{ background: `${habit.color || '#7cc46b'}26` }}
        aria-hidden="true"
      >
        {habit.icon || '✨'}
      </span>
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
        onChange={toggleDone}
        label={done ? 'Desmarcar' : `Marcar ${habit.name} como hecho`}
        color={habit.color || undefined}
      />
    </li>
  );
}
