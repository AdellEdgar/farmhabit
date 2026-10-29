import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import {
  expandEvents,
  getCachedIcs,
  parseIcs,
  setCachedIcs,
  sourceIcs,
  type CalendarOccurrence,
  type CalendarSource,
  type Database,
  type IcsEvent,
} from '@farmhabit/core';
import { isDesktopApp } from './drivers';

// Calendarios externos en la app: descargar las suscripciones, guardarlas en
// la caché local y convertir los .ics en ocurrencias para un rango de fechas.

/** Cada cuánto se vuelven a descargar las suscripciones. */
export const REFRESH_EVERY_MS = 6 * 3_600_000;
const MAX_BYTES = 5 * 1024 * 1024;

export interface SourceEvent extends CalendarOccurrence {
  sourceId: string;
  sourceName: string;
  color: string;
}

// Versión de los calendarios: sube cuando cambia una caché, para repintar.
let version = 0;
const listeners = new Set<() => void>();
function bump() {
  version++;
  for (const l of listeners) l();
}
function useCalendarVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}

/** Descarga una suscripción y la guarda en la caché. Devuelve cuántos eventos tiene. */
export async function refreshSource(db: Database, source: CalendarSource): Promise<number> {
  if (source.kind !== 'url' || !source.url) return 0;
  const doFetch = isDesktopApp ? tauriFetch : window.fetch.bind(window);
  let res: Response;
  try {
    res = await doFetch(source.url, { headers: { Accept: 'text/calendar, */*' } });
  } catch {
    throw new Error(`No se pudo descargar «${source.name}». ¿Hay conexión?`);
  }
  if (!res.ok) throw new Error(`«${source.name}»: el servidor respondió ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error(`«${source.name}» es demasiado grande`);
  try {
    const count = await setCachedIcs(db, source.id, text, Date.now());
    bump();
    return count;
  } catch {
    throw new Error(`«${source.name}» no devolvió un calendario .ics válido`);
  }
}

/** Avisa de que algo cambió (p. ej. tras importar un archivo). */
export function calendarsChanged(): void {
  bump();
}

export async function lastFetched(db: Database, source: CalendarSource): Promise<number | null> {
  return (await getCachedIcs(db, source.id))?.fetchedAt ?? null;
}

// Caché de .ics ya leídos, por fuente y versión de su contenido.
const parsed = new Map<string, { key: string; events: IcsEvent[] }>();

async function eventsOf(db: Database, source: CalendarSource): Promise<IcsEvent[]> {
  const ics = await sourceIcs(db, source);
  if (!ics) return [];
  const key = `${source.updatedAt}:${ics.length}:${ics.slice(-64)}`;
  const hit = parsed.get(source.id);
  if (hit?.key === key) return hit.events;
  try {
    const events = parseIcs(ics);
    parsed.set(source.id, { key, events });
    return events;
  } catch {
    return [];
  }
}

/** Ocurrencias de los calendarios visibles entre dos instantes. */
export function useCalendarEvents(
  db: Database,
  sources: CalendarSource[],
  from: number,
  to: number,
): SourceEvent[] {
  const v = useCalendarVersion();
  const [events, setEvents] = useState<SourceEvent[]>([]);
  const visible = sources.filter((s) => s.visible && s.deletedAt === null);
  const sig = visible.map((s) => `${s.id}:${s.updatedAt}`).join(',');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all: SourceEvent[] = [];
      for (const s of visible) {
        for (const o of expandEvents(await eventsOf(db, s), from, to)) {
          all.push({
            ...o,
            key: `${s.id}|${o.key}`,
            sourceId: s.id,
            sourceName: s.name,
            color: s.color,
          });
        }
      }
      all.sort((a, b) => a.start - b.start);
      if (!cancelled) setEvents(all);
    })();
    return () => {
      cancelled = true;
    };
    // `visible` se resume en `sig`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, sig, from, to, v]);

  return events;
}
