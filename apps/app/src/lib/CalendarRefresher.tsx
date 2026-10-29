import { useEffect, useRef } from 'react';
import { lastFetched, refreshSource, REFRESH_EVERY_MS } from './calendars';
import { useApp } from './use-app';

/** Vuelve a descargar las suscripciones de calendario al abrir y cada pocas horas. */
export function CalendarRefresher() {
  const { db, data } = useApp();
  const sources = useRef(data.calendarSources);
  useEffect(() => {
    sources.current = data.calendarSources;
  });

  useEffect(() => {
    const run = async () => {
      for (const s of sources.current) {
        if (s.kind !== 'url' || s.deletedAt !== null) continue;
        const last = await lastFetched(db, s);
        if (last !== null && Date.now() - last < REFRESH_EVERY_MS) continue;
        // Sin conexión no pasa nada: se reintenta en la próxima vuelta.
        await refreshSource(db, s).catch(() => undefined);
      }
    };
    void run();
    const id = setInterval(() => void run(), 30 * 60_000);
    return () => clearInterval(id);
  }, [db, data.calendarSources.length]);

  return null;
}
