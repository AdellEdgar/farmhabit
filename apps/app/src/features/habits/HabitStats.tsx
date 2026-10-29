import { useMemo } from 'react';
import { Flame, Trophy } from 'lucide-react';
import {
  addDays,
  compareSortKey,
  completionRate,
  dailyCompletion,
  habitCalendar,
  habitStreak,
  startOfWeek,
  toUtcMidnight,
  type DayStatus,
  type Habit,
} from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { formatRelativeDate } from '../../lib/format';
import { useApp } from '../../lib/use-app';
import { Card, EmptyState } from '../../components/ui';
import { streakUnit } from './habit-meta';

/** Semanas que muestra el calendario de cada hábito. */
const WEEKS = 18;
const CHART_DAYS = 30;

const STATUS_CLASS: Record<DayStatus, string> = {
  done: 'bg-acento',
  partial: 'bg-acento/45',
  skipped: 'bg-info/40',
  missed: 'bg-peligro/45',
  pending: 'bg-elevado ring-1 ring-acento/60',
  off: 'bg-elevado',
};

const STATUS_LABEL: Record<DayStatus, string> = {
  done: 'Hecho',
  partial: 'A medias',
  skipped: 'Saltado',
  missed: 'No hecho',
  pending: 'Pendiente',
  off: 'No tocaba',
};

const shortDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function HabitStats() {
  const { data, today } = useApp();
  const habits = useMemo(
    () => data.habits.filter((h) => h.archivedAt === null).sort(compareSortKey),
    [data.habits],
  );
  const chartFrom = addDays(today, -(CHART_DAYS - 1));
  const daily = useMemo(
    () => dailyCompletion(habits, data.habitLogs, chartFrom, today, today),
    [habits, data.habitLogs, chartFrom, today],
  );

  if (habits.length === 0) {
    return (
      <Card>
        <EmptyState icon="📊" title="Aún no hay estadísticas">
          Crea hábitos y márcalos durante unos días para ver aquí tu evolución.
        </EmptyState>
      </Card>
    );
  }

  const counted = daily.filter((d) => d.total > 0 && d.date !== today);
  const avg = counted.length
    ? counted.reduce((s, d) => s + d.done / d.total, 0) / counted.length
    : null;

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Últimos {CHART_DAYS} días</h2>
          {avg !== null && (
            <span className="text-sm text-texto-suave">
              Media: <b className="text-texto">{Math.round(avg * 100)}%</b> de hábitos cumplidos
            </span>
          )}
        </div>
        <DailyChart days={daily} today={today} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {habits.map((h) => (
          <HabitCard key={h.id} habit={h} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-texto-suave">
        {(['done', 'partial', 'skipped', 'missed', 'off'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cx('size-3 rounded-sm', STATUS_CLASS[s])} /> {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras de % de hábitos cumplidos por día (SVG propio, sin librerías). */
function DailyChart({
  days,
  today,
}: {
  days: { date: string; done: number; total: number }[];
  today: string;
}) {
  const w = 600;
  const h = 140;
  const gap = 3;
  const barW = (w - gap * (days.length - 1)) / days.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 18}`}
      className="h-auto w-full"
      role="img"
      aria-label="Porcentaje de hábitos cumplidos cada día"
    >
      {[0.5, 1].map((t) => (
        <line
          key={t}
          x1="0"
          x2={w}
          y1={h - t * h}
          y2={h - t * h}
          stroke="var(--fh-borde)"
          strokeDasharray="4 4"
        />
      ))}
      {days.map((d, i) => {
        const pct = d.total ? d.done / d.total : 0;
        const bh = Math.max(d.total ? 3 : 1, pct * h);
        const x = i * (barW + gap);
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={h - bh}
              width={barW}
              height={bh}
              rx="2"
              fill={
                d.total === 0
                  ? 'var(--fh-borde)'
                  : pct >= 0.9
                    ? 'var(--fh-acento)'
                    : pct >= 0.4
                      ? 'var(--fh-aviso)'
                      : 'var(--fh-peligro)'
              }
              opacity={d.date === today ? 0.55 : 1}
            >
              <title>{`${formatRelativeDate(d.date, today)}: ${d.done} de ${d.total}`}</title>
            </rect>
            {(days.length - 1 - i) % 7 === 0 && (
              <text
                x={x + barW / 2}
                y={h + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--fh-texto-suave)"
              >
                {shortDate.format(toUtcMidnight(d.date)).replace('.', '')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const { data, today } = useApp();
  const from = startOfWeek(addDays(today, -(WEEKS - 1) * 7));
  const calendar = useMemo(
    () => habitCalendar(habit, data.habitLogs, from, addDays(startOfWeek(today), 6), today),
    [habit, data.habitLogs, from, today],
  );
  const last30 = completionRate(
    calendar.filter((c) => c.date > addDays(today, -30) && c.date <= today),
  );
  const streak = habitStreak(habit, data.habitLogs, today);

  // Columnas = semanas (lunes arriba), como el calendario de GitHub.
  const weeks: { date: string; status: DayStatus }[][] = [];
  for (let i = 0; i < calendar.length; i += 7) weeks.push(calendar.slice(i, i + 7));

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="grid size-9 place-items-center rounded-lg text-lg"
          style={{ background: `${habit.color || '#7cc46b'}26` }}
          aria-hidden="true"
        >
          {habit.icon || '✨'}
        </span>
        <p className="min-w-0 flex-1 truncate font-semibold">{habit.name}</p>
        {last30 !== null && (
          <span className="text-sm font-semibold">{Math.round(last30 * 100)}%</span>
        )}
      </div>
      <div
        className="flex gap-[3px] overflow-x-auto pb-1"
        role="img"
        aria-label={`Calendario de ${habit.name}`}
      >
        {weeks.map((week) => (
          <div key={week[0]!.date} className="flex flex-col gap-[3px]">
            {week.map((d) => (
              <span
                key={d.date}
                title={`${formatRelativeDate(d.date, today)}: ${STATUS_LABEL[d.status]}`}
                className={cx(
                  'size-[11px] shrink-0 rounded-[3px]',
                  STATUS_CLASS[d.status],
                  d.date > today && 'opacity-30',
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-texto-suave">
        <span className="inline-flex items-center gap-1">
          <Flame size={13} className="text-aviso" /> Racha: {streak.current}{' '}
          {streakUnit(streak.unit, streak.current)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Trophy size={13} className="text-grano" /> Mejor: {streak.best}{' '}
          {streakUnit(streak.unit, streak.best)}
        </span>
        {last30 !== null && <span>Últimos 30 días</span>}
      </div>
    </Card>
  );
}
