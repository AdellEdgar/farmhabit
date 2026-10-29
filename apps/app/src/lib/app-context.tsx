import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { computeFarm, Database, localDateOf, systemClock } from '@farmhabit/core';
import { createDriver } from './drivers';
import { errorMessage } from './errors';
import { AppContext, type AppData } from './use-app';

async function loadData(db: Database): Promise<AppData> {
  const [
    tasks,
    taskCompletions,
    tags,
    allHabits,
    habitLogs,
    notes,
    noteFolders,
    animals,
    vacations,
    settings,
    calendarSources,
  ] = await Promise.all([
    db.repo('tasks').list(),
    db.repo('taskCompletions').list(),
    db.repo('tags').list(),
    db.repo('habits').list({ includeDeleted: true }),
    db.repo('habitLogs').list(),
    db.repo('notes').list(),
    db.repo('noteFolders').list(),
    db.repo('animals').list(),
    db.repo('vacations').list(),
    db.repo('settings').list(),
    db.repo('calendarSources').list(),
  ]);
  return {
    tasks,
    taskCompletions,
    settings,
    calendarSources,
    tags,
    allHabits,
    habits: allHabits.filter((h) => h.deletedAt === null),
    habitLogs,
    notes,
    noteFolders,
    animals,
    vacations,
  };
}

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [now, setNow] = useState(() => systemClock.now());
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await Database.open(await createDriver());
        const loaded = await loadData(opened);
        if (!cancelled) {
          setDb(opened);
          setData(loaded);
        }
      } catch (e) {
        if (!cancelled) setFatal(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // "Hoy" cambia a medianoche aunque la app siga abierta.
  useEffect(() => {
    const id = setInterval(() => setNow(systemClock.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const toast = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const mutate = useCallback(
    async <T,>(fn: (db: Database) => Promise<T>): Promise<T | undefined> => {
      if (!db) return undefined;
      try {
        const result = await fn(db);
        setData(await loadData(db));
        setNow(systemClock.now());
        return result;
      } catch (e) {
        toast(errorMessage(e), 'error');
        return undefined;
      }
    },
    [db, toast],
  );

  const today = localDateOf(now);
  const farm = useMemo(
    () =>
      data
        ? computeFarm({
            habits: data.allHabits,
            logs: data.habitLogs,
            animals: data.animals,
            vacations: data.vacations,
            today,
          })
        : null,
    [data, today],
  );

  if (fatal) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">No se pudo abrir la base de datos</p>
          <p className="mt-2 text-sm text-texto-suave">{fatal}</p>
        </div>
      </div>
    );
  }
  if (!db || !data || !farm) {
    return <div className="grid h-full place-items-center text-texto-suave">Cargando…</div>;
  }

  return (
    <AppContext.Provider value={{ db, data, farm, today, now, mutate, toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm shadow-lg ${
              t.kind === 'error' ? 'bg-peligro text-white' : 'bg-texto text-fondo'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
