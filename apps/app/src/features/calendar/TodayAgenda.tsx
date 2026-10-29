import { localDateTimeToEpoch } from '@farmhabit/core';
import { useCalendarEvents } from '../../lib/calendars';
import { useApp } from '../../lib/use-app';
import { Card } from '../../components/ui';
import { formatEventTime } from './calendar-format';

/** Eventos de hoy de los calendarios externos (no se muestra si no hay ninguno). */
export function TodayAgenda({ onMore }: { onMore: () => void }) {
  const { db, data, today, now } = useApp();
  const events = useCalendarEvents(
    db,
    data.calendarSources,
    localDateTimeToEpoch(today, '00:00'),
    localDateTimeToEpoch(today, '23:59'),
  );
  if (events.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-semibold">
          Agenda de hoy{' '}
          <span className="ml-2 text-sm font-normal text-texto-suave">{events.length}</span>
        </h2>
        <button
          type="button"
          onClick={onMore}
          className="text-sm text-texto-suave hover:text-texto"
        >
          Ver calendario
        </button>
      </div>
      <Card className="divide-y divide-borde">
        {events.map((e) => {
          const past = !e.allDay && e.end < now;
          return (
            <div
              key={e.key}
              className={`flex items-center gap-3 px-4 py-2.5 ${past ? 'opacity-50' : ''}`}
            >
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: e.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="truncate text-xs text-texto-suave">
                  {formatEventTime(e, today)}
                  {e.location && ` · ${e.location}`}
                </p>
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
