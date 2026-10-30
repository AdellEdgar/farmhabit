import { useEffect, useMemo, useState } from 'react';
import { CalendarCog, ChevronLeft, ChevronRight, MapPin, Plus, Repeat } from 'lucide-react';
import {
  addDays,
  localDateTimeToEpoch,
  monthGrid,
  shiftMonth,
  startOfWeek,
  toUtcMidnight,
  type LocalDate,
  type Task,
} from '@farmhabit/core';
import { useCalendarEvents, type SourceEvent } from '../../lib/calendars';
import { formatLongDate } from '../../lib/format';
import { useApp } from '../../lib/use-app';
import { Button, Card, Dialog, EmptyState, PageHeader, Segmented } from '../../components/ui';
import { TaskEditor } from '../tasks/TaskEditor';
import { TaskItem } from '../tasks/TaskItem';
import { AgendaView } from './AgendaView';
import { CalendarSources } from './CalendarSources';
import { itemsByDay, type CalendarItem, type CalendarView as View } from './calendar-items';
import { formatEventTime } from './calendar-format';
import { MonthView } from './MonthView';
import { TimeGrid } from './TimeGrid';

/** Vista elegida en este dispositivo. */
const VIEW_META = 'calendar:view';
const VIEWS: { value: View; label: string }[] = [
  { value: 'mes', label: 'Mes' },
  { value: 'semana', label: 'Semana' },
  { value: 'dia', label: 'Día' },
  { value: 'agenda', label: 'Agenda' },
];
/** Días que abarca la vista Agenda. */
const AGENDA_DAYS = 30;

const monthTitle = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Días que se ven en cada vista alrededor de `anchor`. */
function rangeOf(view: View, anchor: LocalDate): { from: LocalDate; to: LocalDate } {
  if (view === 'mes') {
    const grid = monthGrid(anchor.slice(0, 7));
    return { from: grid[0]!, to: grid[grid.length - 1]! };
  }
  if (view === 'semana') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  if (view === 'dia') return { from: anchor, to: anchor };
  return { from: anchor, to: addDays(anchor, AGENDA_DAYS - 1) };
}

function titleOf(view: View, anchor: LocalDate, from: LocalDate, to: LocalDate): string {
  if (view === 'mes') return capitalize(monthTitle.format(toUtcMidnight(anchor)));
  if (view === 'dia') return formatLongDate(anchor);
  const year = to.slice(0, 4);
  return `${shortDate.format(toUtcMidnight(from))} – ${shortDate.format(toUtcMidnight(to))} ${year}`;
}

export function CalendarView() {
  const { db, data, today } = useApp();
  const [view, setView] = useState<View>('mes');
  /** Día de referencia: el seleccionado en el mes, el de la vista Día, el inicio de la Agenda… */
  const [anchor, setAnchor] = useState<LocalDate>(today);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [eventOpen, setEventOpen] = useState<{ event: SourceEvent; day: LocalDate } | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    void db.getMeta(VIEW_META).then((v) => {
      if (v && VIEWS.some((o) => o.value === v)) setView(v as View);
    });
  }, [db]);
  const changeView = (v: View) => {
    setView(v);
    void db.setMeta(VIEW_META, v);
  };

  const { from, to } = rangeOf(view, anchor);
  const events = useCalendarEvents(
    db,
    data.calendarSources,
    localDateTimeToEpoch(from, '00:00'),
    localDateTimeToEpoch(to, '23:59'),
  );
  const byDay = useMemo(
    () => itemsByDay(events, data.tasks, from, to),
    [events, data.tasks, from, to],
  );

  const move = (dir: -1 | 1) => {
    if (view === 'mes') {
      const month = shiftMonth(anchor.slice(0, 7), dir);
      setAnchor(today.startsWith(month) ? today : `${month}-01`);
    } else {
      setAnchor(addDays(anchor, dir * (view === 'semana' ? 7 : view === 'dia' ? 1 : AGENDA_DAYS)));
    }
  };
  const openDay = (d: LocalDate) => {
    setAnchor(d);
    changeView('dia');
  };
  const openItem = (item: CalendarItem, day: LocalDate) => {
    if (item.event) setEventOpen({ event: item.event, day });
    else if (item.task) setEditing(item.task.task);
  };
  const dayOf = (item: CalendarItem) => item.key.slice(item.key.lastIndexOf('|') + 1);

  return (
    <>
      <PageHeader
        title="Calendario"
        actions={
          <>
            <Button variant="ghost" onClick={() => setSourcesOpen(true)}>
              <CalendarCog size={16} /> Calendarios
            </Button>
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> Tarea
            </Button>
          </>
        }
      />

      {/* Móvil: título y flechas arriba, vistas debajo. Escritorio: todo en una fila. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 text-lg font-semibold sm:min-w-56 sm:flex-none">
          {titleOf(view, anchor, from, to)}
        </h2>
        <Segmented
          value={view}
          options={VIEWS}
          onChange={changeView}
          className="order-last sm:order-none"
        />
        <div className="flex items-center gap-1 sm:ml-auto">
          <Button variant="ghost" onClick={() => setAnchor(today)}>
            Hoy
          </Button>
          <Button variant="ghost" onClick={() => move(-1)} aria-label="Anterior">
            <ChevronLeft size={18} />
          </Button>
          <Button variant="ghost" onClick={() => move(1)} aria-label="Siguiente">
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {view === 'mes' ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <Card className="p-2 sm:p-3">
            <MonthView
              month={anchor.slice(0, 7)}
              grid={monthGrid(anchor.slice(0, 7))}
              byDay={byDay}
              selected={anchor}
              today={today}
              onSelect={setAnchor}
            />
          </Card>
          <DayPanel
            date={anchor}
            items={byDay.get(anchor) ?? []}
            onOpenTask={setEditing}
            onOpenEvent={(e) => setEventOpen({ event: e, day: anchor })}
            onNewTask={() => setEditing('new')}
            onOpenDay={() => changeView('dia')}
          />
        </div>
      ) : view === 'agenda' ? (
        <Card className="p-3 sm:p-4">
          <AgendaView
            from={from}
            to={to}
            byDay={byDay}
            today={today}
            onItem={(i) => openItem(i, dayOf(i))}
            onOpenTask={setEditing}
          />
        </Card>
      ) : (
        <TimeGrid
          days={
            view === 'semana' ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) : [anchor]
          }
          byDay={byDay}
          today={today}
          onItem={(i) => openItem(i, dayOf(i))}
          onDay={view === 'semana' ? openDay : undefined}
        />
      )}

      {editing !== null && (
        <TaskEditor
          key={editing === 'new' ? `new-${anchor}` : editing.id}
          open
          task={editing === 'new' ? null : editing}
          defaultDate={anchor}
          onClose={() => setEditing(null)}
        />
      )}
      {eventOpen && (
        <EventDialog
          event={eventOpen.event}
          day={eventOpen.day}
          onClose={() => setEventOpen(null)}
        />
      )}
      {sourcesOpen && <CalendarSources onClose={() => setSourcesOpen(false)} />}
    </>
  );
}

/** Detalle de un evento de un calendario suscrito (solo lectura). */
function EventDialog({
  event,
  day,
  onClose,
}: {
  event: SourceEvent;
  day: LocalDate;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={event.title}>
      <div className="space-y-3 text-sm">
        <p>
          {formatLongDate(day)} · {formatEventTime(event, day)}
        </p>
        {event.location && (
          <p className="flex items-center gap-1.5 text-texto-suave">
            <MapPin size={14} /> {event.location}
          </p>
        )}
        {event.description && (
          <p className="whitespace-pre-line text-texto-suave">{event.description}</p>
        )}
        <p className="flex items-center gap-2 text-xs text-texto-suave">
          <span className="size-2.5 rounded-full" style={{ background: event.color }} />
          {event.sourceName}
        </p>
      </div>
    </Dialog>
  );
}

function DayPanel({
  date,
  items,
  onOpenTask,
  onOpenEvent,
  onNewTask,
  onOpenDay,
}: {
  date: LocalDate;
  items: CalendarItem[];
  onOpenTask: (t: Task) => void;
  onOpenEvent: (e: SourceEvent) => void;
  onNewTask: () => void;
  onOpenDay: () => void;
}) {
  const { data } = useApp();
  const events = items.filter((i) => i.event);
  const current = items.filter((i) => i.task && !i.task.upcoming);
  const upcoming = items.filter((i) => i.task?.upcoming);

  return (
    <Card className="self-start p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={onOpenDay} className="font-semibold hover:text-acento">
          {formatLongDate(date)}
        </button>
        <Button variant="ghost" onClick={onNewTask} aria-label="Nueva tarea este día">
          <Plus size={16} /> Tarea
        </Button>
      </div>

      {items.length === 0 && <EmptyState icon="🗓️" title="Nada este día" />}

      {events.length > 0 && (
        <ul className="mb-3 space-y-2">
          {events.map(({ event: e, key, time }) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => onOpenEvent(e!)}
                className="w-full rounded-xl border-l-4 bg-fondo px-3 py-2 text-left hover:bg-elevado"
                style={{ borderColor: e!.color }}
              >
                <span className="block text-xs text-texto-suave">{time}</span>
                <span className="block text-sm font-medium">{e!.title}</span>
                {e!.location && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-texto-suave">
                    <MapPin size={12} /> {e!.location}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {current.length > 0 && (
        <ul className="-mx-2">
          {current.map((i) => (
            <TaskItem key={i.key} task={i.task!.task} tags={data.tags} onOpen={onOpenTask} />
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <ul className="mt-2 space-y-1">
          {upcoming.map((i) => (
            <li key={i.key} className="flex items-center gap-2 px-1 text-sm text-texto-suave">
              <Repeat size={13} /> {i.title}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
