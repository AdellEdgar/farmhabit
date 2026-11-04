import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { readingStats } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Button, Card, EmptyState } from '../../components/ui';

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-fondo px-3 py-2 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-texto-suave">{label}</p>
    </div>
  );
}

export function StatsTab() {
  const { data, today } = useApp();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const stats = useMemo(
    () => readingStats(data.books, data.readingLogs, year, today),
    [data.books, data.readingLogs, year, today],
  );
  const top = Math.max(1, ...stats.byMonth);
  const thisYear = Number(today.slice(0, 4));

  if (stats.byYear.length === 0 && stats.pagesLast30 === 0) {
    return (
      <EmptyState icon="📊" title="Aún no hay estadísticas">
        Cuando termines tu primer libro, aquí verás cuánto lees.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" aria-label="Año anterior" onClick={() => setYear(year - 1)}>
            <ChevronLeft size={18} />
          </Button>
          <p className="font-semibold tabular-nums">{year}</p>
          <Button
            variant="ghost"
            aria-label="Año siguiente"
            disabled={year >= thisYear}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Libros" value={stats.finished} />
          <Stat label="Páginas" value={stats.pages.toLocaleString('es-ES')} />
          <Stat
            label="Nota media"
            value={stats.avgRating === null ? '–' : stats.avgRating.toFixed(1).replace('.', ',')}
          />
          <Stat label="Días por libro" value={stats.avgDays ?? '–'} />
          <Stat label="Páginas en 30 días" value={stats.pagesLast30} />
        </div>
        <ul className="flex h-28 items-end gap-1" aria-label={`Libros por mes de ${year}`}>
          {stats.byMonth.map((n, i) => (
            <li key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              {n > 0 && <span className="text-[10px] tabular-nums">{n}</span>}
              <span
                className="w-full rounded-t bg-acento"
                style={{ height: `${(n / top) * 70}%` }}
              />
              <span className="text-[10px] text-texto-suave">{MONTHS[i]}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.byYear.length > 0 && (
          <Card className="p-4">
            <p className="mb-2 font-semibold">Por años</p>
            <ul className="space-y-1 text-sm">
              {stats.byYear.map((y) => (
                <li key={y.year} className="flex justify-between gap-3 tabular-nums">
                  <span>{y.year}</span>
                  <span className="text-texto-suave">
                    {y.books} {y.books === 1 ? 'libro' : 'libros'} ·{' '}
                    {y.pages.toLocaleString('es-ES')} páginas
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {stats.topAuthors.length > 0 && (
          <Card className="p-4">
            <p className="mb-2 font-semibold">Autores más leídos</p>
            <ul className="space-y-1 text-sm">
              {stats.topAuthors.map((a) => (
                <li key={a.author} className="flex justify-between gap-3">
                  <span className="truncate">{a.author}</span>
                  <span className="shrink-0 text-texto-suave tabular-nums">{a.books}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
