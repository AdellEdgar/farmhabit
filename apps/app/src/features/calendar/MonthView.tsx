import type { LocalDate } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { formatLongDate } from '../../lib/format';
import type { CalendarItem } from './calendar-items';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
/** En pantallas medianas se ven estos; en grandes (lg) se ven todos. */
const VISIBLE_MD = 3;

/** Etiqueta de un elemento dentro de una casilla del mes (hasta dos líneas). */
function ItemChip({ item, onlyLarge }: { item: CalendarItem; onlyLarge?: boolean }) {
  return (
    <span
      className={cx(
        'rounded px-1 text-[11px] leading-4',
        onlyLarge ? 'hidden lg:block' : 'block',
        item.done && 'line-through opacity-60',
      )}
      style={{
        background: `color-mix(in srgb, ${item.color} 22%, transparent)`,
        borderLeft: `2px solid ${item.color}`,
      }}
      title={item.time ? `${item.time} · ${item.title}` : item.title}
    >
      <span className="line-clamp-2 hyphens-auto">
        {item.startTime && (
          <span className="mr-1 text-texto-suave tabular-nums">{item.startTime}</span>
        )}
        {item.title}
      </span>
    </span>
  );
}

export function MonthView({
  month,
  grid,
  byDay,
  selected,
  today,
  onSelect,
}: {
  month: string;
  grid: LocalDate[];
  byDay: Map<LocalDate, CalendarItem[]>;
  selected: LocalDate;
  today: LocalDate;
  onSelect: (d: LocalDate) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-borde bg-borde text-sm">
      {WEEKDAYS.map((w, i) => (
        <div
          key={w}
          className="bg-superficie py-1.5 text-center text-xs font-semibold text-texto-suave"
        >
          <span className="lg:hidden">{w}</span>
          <span className="hidden lg:inline">{WEEKDAYS_LONG[i]}</span>
        </div>
      ))}
      {grid.map((d) => {
        const list = byDay.get(d) ?? [];
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-pressed={d === selected}
            aria-label={`${formatLongDate(d)}: ${list.length} elementos`}
            className={cx(
              'flex min-h-14 min-w-0 flex-col items-stretch gap-0.5 bg-superficie p-1 text-left transition sm:min-h-24 sm:p-1.5 lg:min-h-28',
              !d.startsWith(month) && 'bg-fondo text-texto-suave/60',
              d === selected && 'ring-2 ring-acento ring-inset',
              'hover:bg-elevado',
            )}
          >
            <span
              className={cx(
                'grid size-6 shrink-0 place-items-center self-start rounded-full text-xs font-medium',
                d === today && 'bg-acento text-acento-texto',
              )}
            >
              {Number(d.slice(8))}
            </span>
            {/* Móvil: puntos. Mediano: los primeros. Grande: todos (la fila crece). */}
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
              {list.map((i, n) => (
                <ItemChip key={i.key} item={i} onlyLarge={n >= VISIBLE_MD} />
              ))}
              {list.length > VISIBLE_MD && (
                <span className="px-1 text-[11px] text-texto-suave lg:hidden">
                  +{list.length - VISIBLE_MD} más
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
