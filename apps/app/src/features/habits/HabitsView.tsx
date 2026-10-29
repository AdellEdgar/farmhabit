import { lazy, Suspense, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ListOrdered, Pencil, Plus } from 'lucide-react';
import {
  addDays,
  compareSortKey,
  configOn,
  habitsDueOn,
  isActiveOn,
  moveHabit,
  type Habit,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatLongDate } from '../../lib/format';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  ProgressBar,
  Segmented,
} from '../../components/ui';
import { HabitEditor } from './HabitEditor';
import { HabitRow } from './HabitRow';

import { dayProgress, describeSchedule } from './habit-meta';

const HabitStats = lazy(() => import('./HabitStats').then((m) => ({ default: m.HabitStats })));

export function HabitsView() {
  const { data, farm, today, mutate } = useApp();
  const [which, setWhich] = useState<'hoy' | 'ayer' | 'stats'>('hoy');
  const [organize, setOrganize] = useState(false);
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const date = which === 'ayer' ? addDays(today, -1) : today;

  const active = useMemo(
    () => data.habits.filter((h) => h.archivedAt === null).sort(compareSortKey),
    [data.habits],
  );
  const archived = data.habits.filter((h) => h.archivedAt !== null);
  const due = habitsDueOn(active, date);
  const notDue = active.filter((h) => !due.includes(h) && isActiveOn(h, date) && configOn(h, date));

  const progress = dayProgress(due, data.habitLogs, date);
  const earned =
    (which !== 'ayer' ? farm.todayProgress : farm.days.find((d) => d.date === date))?.earned ?? 0;

  const move = (index: number, dir: -1 | 1) => {
    const h = active[index]!;
    const target = index + dir;
    if (target < 0 || target >= active.length) return;
    // Moverlo entre los dos vecinos del hueco de destino.
    const before = dir === -1 ? (active[target - 1] ?? null) : active[target]!;
    const after = dir === -1 ? active[target]! : (active[target + 1] ?? null);
    void mutate((db) => moveHabit(db, h.id, before?.id ?? null, after?.id ?? null));
  };

  return (
    <>
      <PageHeader
        title="Hábitos"
        subtitle={formatLongDate(date)}
        actions={
          <>
            <Button variant={organize ? 'primary' : 'ghost'} onClick={() => setOrganize(!organize)}>
              <ListOrdered size={16} /> {organize ? 'Listo' : 'Organizar'}
            </Button>
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> Nuevo
            </Button>
          </>
        }
      />

      {organize ? (
        <Card className="p-2">
          <p className="px-3 py-2 text-sm text-texto-suave">
            Ordena tus hábitos por importancia. El de arriba es el primero de la lista.
          </p>
          <ul>
            {active.map((h, i) => (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-elevado"
              >
                <span className="text-xl" aria-hidden="true">
                  {h.icon || '✨'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{h.name}</p>
                  <p className="text-xs text-texto-suave">
                    {describeSchedule(configOn(h, today)?.schedule ?? { type: 'daily' })}
                  </p>
                </div>
                <IconButton label="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp size={16} />
                </IconButton>
                <IconButton
                  label="Bajar"
                  onClick={() => move(i, 1)}
                  disabled={i === active.length - 1}
                >
                  <ArrowDown size={16} />
                </IconButton>
                <IconButton label="Editar" onClick={() => setEditing(h)}>
                  <Pencil size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
          {archived.length > 0 && (
            <>
              <h3 className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">
                Archivados
              </h3>
              <ul>
                {archived.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 opacity-70 hover:bg-elevado"
                  >
                    <span aria-hidden="true">{h.icon || '✨'}</span>
                    <span className="flex-1 truncate">{h.name}</span>
                    <IconButton label="Editar" onClick={() => setEditing(h)}>
                      <Pencil size={16} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={which}
              onChange={setWhich}
              options={[
                { value: 'hoy', label: 'Hoy' },
                { value: 'ayer', label: 'Ayer' },
                { value: 'stats', label: '📊 Estadísticas' },
              ]}
            />
            {which !== 'stats' && progress.total > 0 && (
              <div className="flex min-w-48 flex-1 items-center gap-3 text-sm sm:max-w-xs">
                <ProgressBar value={(progress.done / progress.total) * 100} className="flex-1" />
                <span className="text-texto-suave">
                  {progress.done}/{progress.total} · <span className="text-acento">+{earned}</span>
                </span>
              </div>
            )}
          </div>

          {which === 'ayer' && (
            <p className="mb-3 rounded-xl bg-aviso/10 px-4 py-2.5 text-sm text-aviso">
              Puedes apuntar lo de ayer hasta que acabe hoy. Después el día se cierra.
            </p>
          )}

          {which === 'stats' && (
            <Suspense fallback={<p className="py-12 text-center text-texto-suave">Cargando…</p>}>
              <HabitStats />
            </Suspense>
          )}

          {which !== 'stats' && (
            <Card className="p-2">
              {active.length === 0 ? (
                <EmptyState icon="🌱" title="Aún no tienes hábitos">
                  Crea tu primer hábito: cada uno que cumplas hará crecer tu granja.
                  <div className="mt-4">
                    <Button variant="primary" onClick={() => setEditing('new')}>
                      <Plus size={16} /> Crear hábito
                    </Button>
                  </div>
                </EmptyState>
              ) : due.length === 0 ? (
                <EmptyState
                  icon="😌"
                  title={
                    which === 'hoy'
                      ? 'Hoy no te toca ningún hábito'
                      : 'Ayer no tocaba ningún hábito'
                  }
                />
              ) : (
                <ul>
                  {due.map((h) => (
                    <HabitRow key={`${h.id}-${date}`} habit={h} date={date} onOpen={setEditing} />
                  ))}
                </ul>
              )}
            </Card>
          )}

          {which !== 'stats' && notDue.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">
                No {which === 'hoy' ? 'tocan hoy' : 'tocaban ayer'}
              </h3>
              <ul className="space-y-1">
                {notDue.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(h)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-texto-suave hover:bg-elevado"
                    >
                      <span aria-hidden="true">{h.icon || '✨'}</span>
                      <span className="flex-1 truncate">{h.name}</span>
                      <span className="text-xs">
                        {describeSchedule(configOn(h, date)!.schedule)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {editing !== null && (
        <HabitEditor
          key={editing === 'new' ? 'new' : editing.id}
          habit={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
