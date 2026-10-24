import { useMemo, useState } from 'react';
import { ArrowDownUp, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import {
  completedTasks,
  pendingTasks,
  sortTasks,
  todayTasks,
  upcomingTasks,
  type Task,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatDateTime, formatRelativeDate } from '../../lib/format';
import { useShortcut } from '../../lib/shortcuts';
import {
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  Segmented,
} from '../../components/ui';
import { QuickAdd } from './QuickAdd';
import { TaskEditor } from './TaskEditor';
import { TaskItem } from './TaskItem';

type View = 'hoy' | 'proximas' | 'todas' | 'completadas';
type SortMode = 'dueDate' | 'smart';

const SORT_KEY = 'farmhabit:task-sort';

function loadSort(): SortMode {
  try {
    return localStorage.getItem(SORT_KEY) === 'smart' ? 'smart' : 'dueDate';
  } catch {
    return 'dueDate';
  }
}

export function TasksView() {
  const { data, today, now, mutate } = useApp();
  const [view, setView] = useState<View>('hoy');
  const [sort, setSort] = useState<SortMode>(loadSort);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  useShortcut('n', () => setEditing('new'));

  const toggleSort = () => {
    const next = sort === 'dueDate' ? 'smart' : 'dueDate';
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // preferencia solo para esta sesión
    }
  };

  const filtered = useMemo(
    () => (tagFilter ? data.tasks.filter((t) => t.tagIds.includes(tagFilter)) : data.tasks),
    [data.tasks, tagFilter],
  );

  const list = useMemo(() => {
    switch (view) {
      case 'hoy':
        return sortTasks(todayTasks(filtered, today), sort, now);
      case 'proximas':
        return sortTasks(upcomingTasks(filtered, today), 'dueDate', now);
      case 'todas':
        return sortTasks(pendingTasks(filtered), sort, now);
      case 'completadas':
        return completedTasks(filtered);
    }
  }, [view, filtered, today, now, sort]);

  const counts = {
    hoy: todayTasks(data.tasks, today).length,
    proximas: upcomingTasks(data.tasks, today).length,
    todas: pendingTasks(data.tasks).length,
  };

  // En "Próximas", agrupar por día.
  const groups = useMemo(() => {
    if (view !== 'proximas') return null;
    const map = new Map<string, Task[]>();
    for (const t of list) map.set(t.dueDate!, [...(map.get(t.dueDate!) ?? []), t]);
    return [...map.entries()];
  }, [view, list]);

  const purgeCompleted = async () => {
    await mutate(async (db) => {
      for (const t of completedTasks(data.tasks)) await db.repo('tasks').remove(t.id);
    });
    setConfirmPurge(false);
  };

  return (
    <>
      <PageHeader
        title="Tareas"
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Nueva
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          className="max-w-full overflow-x-auto"
          options={[
            { value: 'hoy', label: `Hoy${counts.hoy ? ` · ${counts.hoy}` : ''}` },
            {
              value: 'proximas',
              label: `Próximas${counts.proximas ? ` · ${counts.proximas}` : ''}`,
            },
            { value: 'todas', label: `Todas${counts.todas ? ` · ${counts.todas}` : ''}` },
            { value: 'completadas', label: 'Completadas' },
          ]}
        />
        {(view === 'hoy' || view === 'todas') && (
          <Button variant="ghost" onClick={toggleSort} title="Cambiar orden">
            {sort === 'smart' ? <Sparkles size={16} /> : <ArrowDownUp size={16} />}
            {sort === 'smart' ? 'Inteligente' : 'Por fecha'}
          </Button>
        )}
      </div>

      {data.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={tagFilter === null} onClick={() => setTagFilter(null)}>
            Todas las etiquetas
          </Chip>
          {data.tags.map((t) => (
            <Chip
              key={t.id}
              active={tagFilter === t.id}
              onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
            >
              <span className="size-2 rounded-full" style={{ background: t.color }} />
              {t.name}
            </Chip>
          ))}
        </div>
      )}

      <Card className="p-2">
        {view !== 'completadas' && (
          <div className="p-1 pb-2">
            <QuickAdd dueDate={view === 'hoy' ? today : null} />
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState
            icon={view === 'completadas' ? '🧺' : view === 'hoy' ? '🌤️' : '📭'}
            title={
              view === 'hoy'
                ? 'Nada pendiente para hoy'
                : view === 'completadas'
                  ? 'Aún no has completado tareas'
                  : 'No hay tareas aquí'
            }
          >
            {view !== 'completadas' && 'Pulsa N o escribe arriba para añadir una.'}
          </EmptyState>
        ) : groups ? (
          groups.map(([date, tasks]) => (
            <div key={date}>
              <h3 className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">
                {formatRelativeDate(date, today)}
              </h3>
              <ul>
                {tasks.map((t) => (
                  <TaskItem key={t.id} task={t} tags={data.tags} onOpen={setEditing} />
                ))}
              </ul>
            </div>
          ))
        ) : view === 'completadas' ? (
          <>
            <ul>
              {list.map((t) => (
                <CompletedRow key={t.id} task={t} onOpen={setEditing} />
              ))}
            </ul>
            <div className="flex justify-end p-2">
              <Button variant="danger" onClick={() => setConfirmPurge(true)}>
                <Trash2 size={16} /> Vaciar completadas
              </Button>
            </div>
          </>
        ) : (
          <ul>
            {list.map((t) => (
              <TaskItem key={t.id} task={t} tags={data.tags} onOpen={setEditing} />
            ))}
          </ul>
        )}
      </Card>

      {editing !== null && (
        <TaskEditor
          key={editing === 'new' ? 'new' : editing.id}
          open
          task={editing === 'new' ? null : editing}
          defaultDate={view === 'hoy' ? today : null}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title="Vaciar completadas"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmPurge(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={purgeCompleted}>
              Borrar definitivamente
            </Button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          Se borrarán {completedTasks(data.tasks).length} tareas completadas. Esta acción no se
          puede deshacer.
        </p>
      </Dialog>
    </>
  );
}

function CompletedRow({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { mutate } = useApp();
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-elevado">
      <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-texto-suave line-through">{task.title}</p>
        {task.completedAt && (
          <p className="text-xs text-texto-suave">
            Completada el {formatDateTime(task.completedAt)}
          </p>
        )}
      </button>
      <IconButton
        label="Volver a pendientes"
        onClick={() =>
          mutate((db) => db.repo('tasks').update(task.id, { status: 'pending', completedAt: null }))
        }
      >
        <RotateCcw size={16} />
      </IconButton>
      <IconButton
        label="Borrar definitivamente"
        onClick={() => mutate((db) => db.repo('tasks').remove(task.id))}
        className="hover:text-peligro"
      >
        <Trash2 size={16} />
      </IconButton>
    </li>
  );
}
