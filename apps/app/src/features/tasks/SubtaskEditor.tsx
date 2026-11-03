import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  addSubtask,
  deleteSubtask,
  renameSubtask,
  setSubtaskDone,
  subtasksOf,
  type Subtask,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { cx } from '../../lib/cx';
import { Button, CheckCircle, IconButton, Input } from '../../components/ui';

/**
 * Subtareas en el editor de tareas. Si la tarea ya existe, cada cambio se
 * guarda al momento; si es nueva, se guardan como borrador (`pending`) y se
 * crean al guardar la tarea.
 */
export function SubtaskEditor({
  taskId,
  pending,
  onPendingChange,
}: {
  taskId: string | null;
  pending: string[];
  onPendingChange: (titles: string[]) => void;
}) {
  const { data, mutate, today, toast } = useApp();
  const [title, setTitle] = useState('');
  const subtasks = taskId ? subtasksOf(data.subtasks, taskId) : [];

  const add = async () => {
    const clean = title.trim();
    if (!clean) return;
    setTitle('');
    if (taskId) await mutate((db) => addSubtask(db, taskId, clean));
    else onPendingChange([...pending, clean]);
  };

  const toggle = (s: Subtask) =>
    mutate(async (db) => {
      const res = await setSubtaskDone(db, s.id, !s.done, today);
      if (res.autoCompleted) toast('Todas las subtareas hechas: tarea completada');
      return res;
    });

  const rename = (s: Subtask, value: string) => {
    if (value.trim() && value.trim() !== s.title)
      void mutate((db) => renameSubtask(db, s.id, value));
  };

  return (
    <div className="space-y-2">
      {subtasks.length + pending.length > 0 && (
        <ul className="space-y-1.5">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <CheckCircle
                small
                checked={s.done}
                onChange={() => void toggle(s)}
                label={s.done ? `Desmarcar «${s.title}»` : `Hacer «${s.title}»`}
              />
              <Input
                // `key` con el título: si cambia desde otro sitio, el campo se rehace.
                key={s.title}
                defaultValue={s.title}
                aria-label="Subtarea"
                onBlur={(e) => rename(s, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className={cx('py-1.5', s.done && 'text-texto-suave line-through')}
              />
              <IconButton
                label={`Borrar «${s.title}»`}
                onClick={() => void mutate((db) => deleteSubtask(db, s.id, today))}
              >
                <X size={16} />
              </IconButton>
            </li>
          ))}
          {pending.map((p, i) => (
            <li key={`${i}-${p}`} className="flex items-center gap-2">
              <CheckCircle small checked={false} onChange={() => {}} label={p} />
              <span className="flex-1 px-3 py-1.5 text-sm">{p}</span>
              <IconButton
                label={`Quitar «${p}»`}
                onClick={() => onPendingChange(pending.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Añadir subtarea"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
        />
        <Button onClick={() => void add()} disabled={!title.trim()}>
          <Plus size={16} /> Añadir
        </Button>
      </div>
    </div>
  );
}
