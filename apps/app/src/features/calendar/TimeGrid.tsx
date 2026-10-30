import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { localDateTimeToEpoch, toUtcMidnight, type LocalDate } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { layoutTimed, type CalendarItem } from './calendar-items';

/** Alto de una hora en px. */
const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Al abrir, se baja hasta esta hora (o hasta lo primero del día, si es antes). */
const SCROLL_TO_HOUR = 7;

const weekdayShort = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' });

function minutesInDay(day: LocalDate, epoch: number): number {
  return (epoch - localDateTimeToEpoch(day, '00:00')) / 60_000;
}

/** Minutos desde medianoche ahora mismo; se actualiza cada minuto. */
function useNowMinutes(today: LocalDate): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return minutesInDay(today, now);
}

/**
 * Vista por horas (semana o día): arriba lo que dura todo el día y debajo una
 * rejilla de 24 h con los eventos colocados por hora. Los que se solapan se
 * reparten el ancho.
 */
export function TimeGrid({
  days,
  byDay,
  today,
  onItem,
  onDay,
}: {
  days: LocalDate[];
  byDay: Map<LocalDate, CalendarItem[]>;
  today: LocalDate;
  onItem: (item: CalendarItem) => void;
  /** Pulsar la cabecera de un día (en la semana, abre ese día). */
  onDay?: (d: LocalDate) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const nowMinutes = useNowMinutes(today);
  const columns = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` };
  const allDay = days.map((d) => (byDay.get(d) ?? []).filter((i) => i.allDay));
  const hasAllDay = allDay.some((l) => l.length > 0);

  // Bajar a la mañana al cambiar de semana o de día.
  const firstHour = Math.min(
    SCROLL_TO_HOUR,
    ...days.flatMap((d) =>
      (byDay.get(d) ?? [])
        .filter((i) => !i.allDay)
        .map((i) => Math.floor(minutesInDay(d, i.start) / 60)),
    ),
  );
  const rangeKey = `${days[0]}|${days.length}`;
  useEffect(() => {
    scroller.current?.scrollTo({ top: Math.max(0, firstHour - 0.5) * HOUR_PX });
    // Solo al cambiar de rango, no cada vez que cambian los eventos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  return (
    <div className="overflow-hidden rounded-xl border border-borde text-sm">
      {/* Cabecera con los días */}
      <div
        className="grid overflow-y-hidden border-b border-borde bg-superficie [scrollbar-gutter:stable]"
        style={columns}
      >
        <div />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDay?.(d)}
            disabled={!onDay}
            className="flex flex-col items-center gap-0.5 border-l border-borde py-1.5 enabled:hover:bg-elevado"
          >
            <span className="text-[11px] text-texto-suave uppercase">
              {weekdayShort.format(toUtcMidnight(d)).replace('.', '')}
            </span>
            <span
              className={cx(
                'grid size-7 place-items-center rounded-full text-sm font-semibold',
                d === today && 'bg-acento text-acento-texto',
              )}
            >
              {Number(d.slice(8))}
            </span>
          </button>
        ))}
      </div>

      {/* Todo el día: eventos de día completo y tareas sin hora */}
      {hasAllDay && (
        <div
          className="grid overflow-y-hidden border-b border-borde bg-superficie [scrollbar-gutter:stable]"
          style={columns}
        >
          <div className="px-1 py-1.5 text-right text-[10px] leading-3 text-texto-suave">
            Todo el día
          </div>
          {allDay.map((list, i) => (
            <div key={days[i]} className="flex min-w-0 flex-col gap-0.5 border-l border-borde p-1">
              {list.map((item) => (
                <ItemBlock key={item.key} item={item} onClick={() => onItem(item)} compact />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Rejilla de horas */}
      <div
        ref={scroller}
        className="max-h-[calc(100dvh-16rem)] min-h-80 overflow-y-auto bg-fondo [scrollbar-gutter:stable]"
      >
        <div className="grid" style={columns}>
          <div className="relative" style={{ height: 24 * HOUR_PX }}>
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-texto-suave tabular-nums"
                style={{ top: h * HOUR_PX }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              className="relative border-l border-borde"
              style={{
                height: 24 * HOUR_PX,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--fh-borde) ${HOUR_PX - 1}px, var(--fh-borde) ${HOUR_PX}px)`,
              }}
            >
              {layoutTimed((byDay.get(d) ?? []).filter((i) => !i.allDay)).map(
                ({ item, col, cols }) => {
                  const top = (minutesInDay(d, item.start) / 60) * HOUR_PX;
                  const height = Math.max(
                    ((item.end - item.start) / 3_600_000) * HOUR_PX,
                    HOUR_PX / 2.5,
                  );
                  return (
                    <ItemBlock
                      key={item.key}
                      item={item}
                      onClick={() => onItem(item)}
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                      }}
                    />
                  );
                },
              )}
              {d === today && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-peligro"
                  style={{ top: (nowMinutes / 60) * HOUR_PX }}
                  aria-hidden="true"
                >
                  <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-peligro" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemBlock({
  item,
  onClick,
  style,
  compact,
}: {
  item: CalendarItem;
  onClick: () => void;
  style?: CSSProperties;
  compact?: boolean;
}) {
  const location = item.event?.location;
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.time ? `${item.time} · ${item.title}` : item.title}
      className={cx(
        'min-w-0 overflow-hidden rounded-md px-1.5 text-left text-[11px] leading-4 transition hover:brightness-110',
        compact ? 'py-0.5' : 'absolute py-1',
        item.done && 'line-through opacity-60',
      )}
      style={{
        background: `color-mix(in srgb, ${item.color} 28%, var(--fh-superficie))`,
        borderLeft: `3px solid ${item.color}`,
        ...style,
      }}
    >
      <span className={cx('block font-medium', compact && 'truncate')}>{item.title}</span>
      {!compact && <span className="block truncate text-texto-suave">{item.time}</span>}
      {!compact && location && <span className="block truncate text-texto-suave">{location}</span>}
    </button>
  );
}
