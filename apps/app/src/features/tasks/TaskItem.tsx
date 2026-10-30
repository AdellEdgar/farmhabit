import { Bell, Repeat } from 'lucide-react';
import { completeTask, isOverdue, reopenTask, type Tag, type Task } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatDue } from '../../lib/format';
import { cx } from '../../lib/cx';
import { CheckCircle } from '../../components/ui';
import { priorityMeta } from './task-meta';

export function TaskItem({
  task,
  tags,
  onOpen,
}: {
  task: Task;
  tags: Tag[];
  onOpen: (t: Task) => void;
}) {
  const { mutate, today, now, toast } = useApp();
  const done = task.status === 'done';
  const overdue = isOverdue(task, now);
  const prio = priorityMeta(task.priority);
  const taskTags = tags.filter((t) => task.tagIds.includes(t.id));

  const toggle = () =>
    mutate(async (db) => {
      if (done) return reopenTask(db, task.id);
      const updated = await completeTask(db, task.id, today);
      if (updated.status === 'pending' && updated.dueDate) {
        toast(`Hecho. Siguiente: ${formatDue(updated.dueDate, updated.dueTime, today)}`);
      }
      return updated;
    });

  return (
    <li className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-elevado">
      <div className="pt-0.5">
        <CheckCircle
          checked={done}
          onChange={toggle}
          label={done ? 'Marcar como pendiente' : 'Completar tarea'}
          color={prio.color}
        />
      </div>
      <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
        <p
          className={cx(
            'text-[15px] leading-snug break-words',
            done && 'text-texto-suave line-through',
          )}
        >
          {task.title || <span className="text-texto-suave italic">Sin título</span>}
        </p>
        {/* La descripción entera, con sus saltos de línea: la tarea crece lo que haga falta. */}
        {task.notes && (
          <p className="mt-1 text-[13px] leading-snug break-words whitespace-pre-line text-texto-suave">
            {task.notes}
          </p>
        )}
        {(task.dueDate || task.rrule || task.reminders.length > 0 || taskTags.length > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
            {task.dueDate && (
              <span className={cx(overdue && !done && 'font-medium text-peligro')}>
                {formatDue(task.dueDate, task.dueTime, today)}
              </span>
            )}
            {task.rrule && <Repeat size={13} aria-label="Se repite" />}
            {task.reminders.length > 0 && <Bell size={13} aria-label="Con aviso" />}
            {taskTags.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  );
}
