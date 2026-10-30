import { MapPin, Repeat } from 'lucide-react';
import { eachDay, type LocalDate, type Task } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { formatLongDate } from '../../lib/format';
import { useApp } from '../../lib/use-app';
import { EmptyState } from '../../components/ui';
import { TaskItem } from '../tasks/TaskItem';
import type { CalendarItem } from './calendar-items';

/** Lista de los días con algo entre `from` y `to`, con todo su detalle. */
export function AgendaView({
  from,
  to,
  byDay,
  today,
  onItem,
  onOpenTask,
}: {
  from: LocalDate;
  to: LocalDate;
  byDay: Map<LocalDate, CalendarItem[]>;
  today: LocalDate;
  onItem: (item: CalendarItem) => void;
  onOpenTask: (t: Task) => void;
}) {
  const { data } = useApp();
  const days = [...eachDay(from, to)].filter((d) => (byDay.get(d)?.length ?? 0) > 0);

  if (days.length === 0) return <EmptyState icon="🗓️" title="Nada en estos días" />;

  return (
    <div className="space-y-5">
      {days.map((d) => (
        <section key={d}>
          <h3
            className={cx(
              'mb-1.5 flex items-center gap-2 text-sm font-semibold',
              d === today ? 'text-acento' : 'text-texto-suave',
            )}
          >
            {formatLongDate(d)}
            {d === today && (
              <span className="rounded-full bg-acento-suave px-2 py-0.5 text-[11px]">Hoy</span>
            )}
          </h3>
          <ul className="space-y-1">
            {byDay.get(d)!.map((item) =>
              item.task && !item.task.upcoming ? (
                <TaskItem
                  key={item.key}
                  task={item.task.task}
                  tags={data.tags}
                  onOpen={onOpenTask}
                />
              ) : (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onItem(item)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-elevado"
                  >
                    <span className="w-24 shrink-0 pt-0.5 text-xs text-texto-suave tabular-nums">
                      {item.time || 'Todo el día'}
                    </span>
                    <span
                      className="mt-0.5 w-1 self-stretch rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[15px] leading-snug">
                        {item.task && <Repeat size={13} className="shrink-0 text-texto-suave" />}
                        {item.title}
                      </span>
                      {item.event?.location && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-texto-suave">
                          <MapPin size={12} /> {item.event.location}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
