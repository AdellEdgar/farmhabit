import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { compareSortKey, habitsDueOn, sortTasks, todayTasks, type Task } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatLongDate, greeting } from '../../lib/format';
import { useNavigation } from '../../lib/navigation';
import { useShortcut } from '../../lib/shortcuts';
import { Card, EmptyState } from '../../components/ui';
import { FarmSummary } from '../farm/FarmSummary';
import { HabitRow } from '../habits/HabitRow';
import { dayProgress } from '../habits/habit-meta';
import { QuickAdd } from '../tasks/QuickAdd';
import { TaskEditor } from '../tasks/TaskEditor';
import { TaskItem } from '../tasks/TaskItem';

export function TodayView() {
  const { data, farm, today, now } = useApp();
  const { go } = useNavigation();
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  useShortcut('n', () => setEditing('new'));

  const tasks = sortTasks(todayTasks(data.tasks, today), 'dueDate', now);
  const habits = habitsDueOn(
    data.habits.filter((h) => h.archivedAt === null).sort(compareSortKey),
    today,
  );
  const progress = dayProgress(habits, data.habitLogs, today);

  return (
    <>
      <header className="mb-6">
        <p className="text-sm text-texto-suave">{formatLongDate(today)}</p>
        <h1 className="text-3xl font-bold tracking-tight">{greeting(now)} 👋</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <section>
            <SectionTitle title="Tareas de hoy" count={tasks.length} onMore={() => go('tareas')} />
            <Card className="p-2">
              <div className="p-1 pb-2">
                <QuickAdd dueDate={today} placeholder="Añadir tarea para hoy…" />
              </div>
              {tasks.length === 0 ? (
                <EmptyState icon="🌤️" title="Nada pendiente para hoy" />
              ) : (
                <ul>
                  {tasks.map((t) => (
                    <TaskItem key={t.id} task={t} tags={data.tags} onOpen={setEditing} />
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle
              title="Hábitos de hoy"
              count={habits.length ? `${progress.done}/${progress.total}` : undefined}
              onMore={() => go('habitos')}
            />
            <Card className="p-2">
              {habits.length === 0 ? (
                <EmptyState
                  icon="🌱"
                  title={
                    data.habits.length ? 'Hoy no te toca ningún hábito' : 'Aún no tienes hábitos'
                  }
                >
                  {!data.habits.length && 'Créalos en la sección Hábitos.'}
                </EmptyState>
              ) : (
                <ul>
                  {habits.map((h) => (
                    <HabitRow key={h.id} habit={h} date={today} compact />
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>

        <aside className="order-first lg:order-last">
          <FarmSummary farm={farm} onOpen={() => go('granja')} />
        </aside>
      </div>

      {editing !== null && (
        <TaskEditor
          key={editing === 'new' ? 'new' : editing.id}
          open
          task={editing === 'new' ? null : editing}
          defaultDate={today}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function SectionTitle({
  title,
  count,
  onMore,
}: {
  title: string;
  count?: number | string;
  onMore: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="font-semibold">
        {title}
        {count !== undefined && count !== 0 && (
          <span className="ml-2 text-sm font-normal text-texto-suave">{count}</span>
        )}
      </h2>
      <button
        type="button"
        onClick={onMore}
        className="inline-flex items-center text-sm text-texto-suave hover:text-texto"
      >
        Ver todo <ChevronRight size={16} />
      </button>
    </div>
  );
}
