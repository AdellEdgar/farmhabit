import { useMemo, useState } from 'react';
import { CalendarCog, ChevronLeft, ChevronRight, MapPin, Plus, Repeat } from 'lucide-react';
import {
  eachDay,
  localDateTimeToEpoch,
  monthGrid,
  shiftMonth,
  tasksInRange,
  toUtcMidnight,
  type AgendaTask,
  type LocalDate,
  type Task,
} from '@farmhabit/core';
import { useCalendarEvents, type SourceEvent } from '../../lib/calendars';
import { cx } from '../../lib/cx';
import { formatLongDate } from '../../lib/format';
import { useApp } from '../../lib/use-app';
import { Button, Card, EmptyState, PageHeader } from '../../components/ui';
import { TaskEditor } from '../tasks/TaskEditor';
import { TaskItem } from '../tasks/TaskItem';
import { CalendarSources } from './CalendarSources';
import { formatEventTime } from './calendar-format';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const monthTitle = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

interface DayItems {
  events: SourceEvent[];
  tasks: AgendaTask[];
}

export function CalendarView() {
  const { db, data, today } = useApp();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<LocalDate>(today);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const grid = useMemo(() => monthGrid(month), [month]);
  const from = localDateTimeToEpoch(grid[0]!, '00:00');
  const to = localDateTimeToEpoch(grid[41]!, '23:59');
  const events = useCalendarEvents(db, data.calendarSources, from, to);

  const byDay = useMemo(() => {
    const map = new Map<LocalDate, DayItems>();
    const slot = (d: LocalDate) => {
      let s = map.get(d);
      if (!s) map.set(d, (s = { events: [], tasks: [] }));
      return s;
    };
    for (const e of events) {
      // Los eventos de varios días aparecen en todos sus días.
      for (const d of eachDay(e.startDate, e.endDate)) {
        if (d >= grid[0]! && d <= grid[41]!) slot(d).events.push(e);
      }
    }
    for (const t of tasksInRange(data.tasks, grid[0]!, grid[41]!)) slot(t.date).tasks.push(t);
    return map;
  }, [events, data.tasks, grid]);

  const goMonth = (delta: number) => setMonth(shiftMonth(month, delta));
  const goToday = () => {
    setMonth(today.slice(0, 7));
    setSelected(today);
  };
  const rawTitle = monthTitle.format(toUtcMidnight(`${month}-01`));
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const day = byDay.get(selected) ?? { events: [], tasks: [] };

  return (
    <>
      <PageHeader
        title="Calendario"
        actions={
          <Button variant="ghost" onClick={() => setSourcesOpen(true)}>
            <CalendarCog size={16} /> Calendarios
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="flex-1 text-lg font-semibold">{title}</h2>
            <Button variant="ghost" onClick={goToday}>
              Hoy
            </Button>
            <Button variant="ghost" onClick={() => goMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft size={18} />
            </Button>
            <Button variant="ghost" onClick={() => goMonth(1)} aria-label="Mes siguiente">
              <ChevronRight size={18} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-borde bg-borde text-sm">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="bg-superficie py-1.5 text-center text-xs font-semibold text-texto-suave"
              >
                {w}
              </div>
            ))}
            {grid.map((d) => {
              const items = byDay.get(d);
              const inMonth = d.startsWith(month);
              const list = [
                ...(items?.events ?? []).map((e) => ({
                  key: e.key,
                  label: e.title,
                  color: e.color,
                  done: false,
                })),
                ...(items?.tasks ?? []).map((t) => ({
                  key: `${t.task.id}|${t.date}`,
                  label: t.task.title,
                  color: 'var(--fh-acento)',
                  done: t.task.status === 'done' && !t.upcoming,
                })),
              ];
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  aria-pressed={d === selected}
                  aria-label={`${formatLongDate(d)}: ${list.length} elementos`}
                  className={cx(
                    'flex min-h-14 flex-col items-stretch gap-0.5 bg-superficie p-1 text-left transition sm:min-h-24 sm:p-1.5',
                    !inMonth && 'bg-fondo text-texto-suave/60',
                    d === selected && 'ring-2 ring-inset ring-acento',
                    'hover:bg-elevado',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-6 place-items-center self-start rounded-full text-xs font-medium',
                      d === today && 'bg-acento text-acento-texto',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {/* Móvil: puntos. Escritorio: títulos. */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((i) => (
                      <span
                        key={i.key}
                        className="size-1.5 rounded-full"
                        style={{ background: i.color }}
                      />
                    ))}
                  </span>
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {list.slice(0, 3).map((i) => (
                      <span
                        key={i.key}
                        className={cx(
                          'truncate rounded px-1 text-[11px] leading-4',
                          i.done && 'line-through opacity-60',
                        )}
                        style={{
                          background: `color-mix(in srgb, ${i.color} 22%, transparent)`,
                          borderLeft: `2px solid ${i.color}`,
                        }}
                      >
                        {i.label}
                      </span>
                    ))}
                    {list.length > 3 && (
                      <span className="px-1 text-[11px] text-texto-suave">
                        +{list.length - 3} más
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <DayPanel
          date={selected}
          items={day}
          onOpenTask={setEditing}
          onNewTask={() => setEditing('new')}
        />
      </div>

      {editing !== null && (
        <TaskEditor
          key={editing === 'new' ? `new-${selected}` : editing.id}
          open
          task={editing === 'new' ? null : editing}
          defaultDate={selected}
          onClose={() => setEditing(null)}
        />
      )}
      {sourcesOpen && <CalendarSources onClose={() => setSourcesOpen(false)} />}
    </>
  );
}

function DayPanel({
  date,
  items,
  onOpenTask,
  onNewTask,
}: {
  date: LocalDate;
  items: DayItems;
  onOpenTask: (t: Task) => void;
  onNewTask: () => void;
}) {
  const { data } = useApp();
  const current = items.tasks.filter((t) => !t.upcoming);
  const upcoming = items.tasks.filter((t) => t.upcoming);
  const empty = items.events.length === 0 && items.tasks.length === 0;

  return (
    <Card className="self-start p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{formatLongDate(date)}</h2>
        <Button variant="ghost" onClick={onNewTask} aria-label="Nueva tarea este día">
          <Plus size={16} /> Tarea
        </Button>
      </div>

      {empty && <EmptyState icon="🗓️" title="Nada este día" />}

      {items.events.length > 0 && (
        <ul className="mb-3 space-y-2">
          {items.events.map((e) => (
            <li
              key={e.key}
              className="rounded-xl border-l-4 bg-fondo px-3 py-2"
              style={{ borderColor: e.color }}
            >
              <p className="text-xs text-texto-suave">{formatEventTime(e, date)}</p>
              <p className="text-sm font-medium">{e.title}</p>
              {e.location && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-texto-suave">
                  <MapPin size={12} /> {e.location}
                </p>
              )}
              {e.description && (
                <details className="mt-1 text-xs text-texto-suave">
                  <summary className="cursor-pointer">Detalles</summary>
                  <p className="mt-1 whitespace-pre-line">{e.description}</p>
                </details>
              )}
              <p className="mt-1 text-[11px] text-texto-suave">{e.sourceName}</p>
            </li>
          ))}
        </ul>
      )}

      {current.length > 0 && (
        <ul className="-mx-2">
          {current.map((t) => (
            <TaskItem key={t.task.id} task={t.task} tags={data.tags} onOpen={onOpenTask} />
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <ul className="mt-2 space-y-1">
          {upcoming.map((t) => (
            <li
              key={`${t.task.id}|${t.date}`}
              className="flex items-center gap-2 px-1 text-sm text-texto-suave"
            >
              <Repeat size={13} /> {t.task.title}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
